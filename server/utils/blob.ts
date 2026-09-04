import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const PRESIGNED_EXPIRY_SECONDS = 7 * 24 * 60 * 60 // 7 days (Vercel max)

// ---------------------------------------------------------------------------
// In-memory cache (fast path, survives across requests in same process)
// ---------------------------------------------------------------------------

interface CachedUrl {
  url: string
  expiresAt: number
}

const memCache = new Map<string, CachedUrl>()

// ---------------------------------------------------------------------------
// Generation locks (prevent duplicate API calls for same pathname)
// ---------------------------------------------------------------------------

const generationLocks = new Map<string, Promise<string>>()

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a stable, cacheable URL for a blob file.
 *
 * In all environments, images are served through /api/blob/<pathname>.
 * The endpoint sets Cache-Control: public, max-age=31536000, immutable
 * so the browser caches each image permanently after the first fetch.
 */
export function getBlobUrl(pathname: string): string {
  return `/api/blob/${pathname}`
}

/**
 * Get a presigned URL for direct blob access.
 * Checks memory cache → DB cache → generates new (with lock).
 * Used by the blob proxy endpoint.
 */
export async function getPresignedBlobUrl(pathname: string): Promise<string> {
  // 1. Memory cache (fastest)
  const mem = memCache.get(pathname)
  if (mem && Date.now() < mem.expiresAt) {
    return mem.url
  }

  // 2. DB cache (survives restarts)
  const dbEntry = await getFromDbCache(pathname)
  if (dbEntry && dbEntry.expiresAt.getTime() > Date.now()) {
    // Warm memory cache from DB
    memCache.set(pathname, { url: dbEntry.url, expiresAt: dbEntry.expiresAt.getTime() })
    incrementHitCount(pathname).catch(() => {}) // fire-and-forget
    return dbEntry.url
  }

  // 3. Cache miss — generate new presigned URL (with lock to prevent races)
  return acquireGenerationLock(pathname)
}

/**
 * Invalidate cached presigned URL for a pathname.
 * Called when a blob is deleted.
 */
export async function invalidatePresignedUrl(pathname: string): Promise<void> {
  memCache.delete(pathname)
  await db
    .delete(schema.presignedUrlCache)
    .where(eq(schema.presignedUrlCache.blobPathname, pathname))
}

/**
 * Invalidate all cached URLs matching a prefix.
 * Useful when deleting all blobs for a user or photo.
 */
export async function invalidatePresignedUrlsByPrefix(prefix: string): Promise<void> {
  // Clear memory cache entries
  for (const key of memCache.keys()) {
    if (key.startsWith(prefix)) memCache.delete(key)
  }
  // Clear DB entries
  await db
    .delete(schema.presignedUrlCache)
    .where(sql`${schema.presignedUrlCache.blobPathname} LIKE ${prefix + '%'}`)
}

/**
 * Get cache metrics for monitoring/debugging.
 */
export async function getPresignedCacheMetrics() {
  const [result] = await db
    .select({
      totalCached: sql<number>`count(*)`,
      totalHits: sql<number>`coalesce(sum(${schema.presignedUrlCache.hitCount}), 0)`,
      activeUrls: sql<number>`count(CASE WHEN ${schema.presignedUrlCache.expiresAt} > now() THEN 1 END)`,
      expiredUrls: sql<number>`count(CASE WHEN ${schema.presignedUrlCache.expiresAt} <= now() THEN 1 END)`,
    })
    .from(schema.presignedUrlCache)

  return result
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function acquireGenerationLock(pathname: string): Promise<string> {
  // If another request is already generating, wait for it
  if (generationLocks.has(pathname)) {
    return generationLocks.get(pathname)!
  }

  const promise = generateAndCache(pathname)
  generationLocks.set(pathname, promise)

  try {
    return await promise
  } finally {
    generationLocks.delete(pathname)
  }
}

async function generateAndCache(pathname: string): Promise<string> {
  console.log(`[Blob] Cache miss for ${pathname}, generating presigned URL`)

  try {
    const presignedUrl = await generatePresignedUrl(pathname)
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS)

    // Write to DB
    await db
      .insert(schema.presignedUrlCache)
      .values({
        blobPathname: pathname,
        presignedUrl,
        expiresAt,
        hitCount: 0,
      })
      .onConflictDoUpdate({
        target: schema.presignedUrlCache.blobPathname,
        set: {
          presignedUrl,
          expiresAt,
          hitCount: 0,
          createdAt: new Date(),
          lastAccessedAt: null,
        },
      })

    // Warm memory cache
    memCache.set(pathname, { url: presignedUrl, expiresAt: expiresAt.getTime() })

    return presignedUrl
  } catch (err) {
    // Fallback: return expired cached URL if available
    const expired = memCache.get(pathname)?.url
      || (await getFromDbCache(pathname))?.url
    if (expired) {
      console.warn(`[Blob] Generation failed for ${pathname}, returning expired cached URL`)
      return expired
    }
    throw err
  }
}

async function generatePresignedUrl(pathname: string): Promise<string> {
  const { presignUrl } = await import('@vercel/blob')
  const token = await getDelegationToken()
  const { presignedUrl } = await presignUrl(token, {
    pathname,
    access: 'private',
    operation: 'get',
    validUntil: Date.now() + PRESIGNED_EXPIRY_SECONDS * 1000,
  })
  return presignedUrl
}

async function getFromDbCache(pathname: string): Promise<{ url: string; expiresAt: Date } | null> {
  const [row] = await db
    .select({
      url: schema.presignedUrlCache.presignedUrl,
      expiresAt: schema.presignedUrlCache.expiresAt,
    })
    .from(schema.presignedUrlCache)
    .where(eq(schema.presignedUrlCache.blobPathname, pathname))
    .limit(1)

  return row || null
}

async function incrementHitCount(pathname: string): Promise<void> {
  await db
    .update(schema.presignedUrlCache)
    .set({
      hitCount: sql`${schema.presignedUrlCache.hitCount} + 1`,
      lastAccessedAt: new Date(),
    })
    .where(eq(schema.presignedUrlCache.blobPathname, pathname))
}

// ---------------------------------------------------------------------------
// Delegation token (for Vercel Blob API auth)
// ---------------------------------------------------------------------------

let cachedToken: any = null
let tokenExpiresAt = 0

export async function getDelegationToken() {
  if (process.dev || process.env.COLLCT_BLOB_DIR) return null

  const now = Date.now()
  if (cachedToken && now < tokenExpiresAt) return cachedToken

  const { issueSignedToken } = await import('@vercel/blob')
  cachedToken = await issueSignedToken({
    validUntil: now + 60 * 60 * 1000,
    operations: ['get'],
  })
  tokenExpiresAt = now + 55 * 60 * 1000
  return cachedToken
}

// ---------------------------------------------------------------------------
// SQL helper import
// ---------------------------------------------------------------------------

import { sql } from 'drizzle-orm'
