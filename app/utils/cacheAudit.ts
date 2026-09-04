/**
 * Image Caching Audit Tool
 *
 * Diagnoses why images are being re-fetched on every page load.
 * Checks HTTP headers, browser cache, Service Worker cache storage,
 * and network activity to identify the root cause.
 *
 * Run from the dev/cache-audit page or call runCachingAudit() directly.
 */

interface AuditIssue {
  severity: 'error' | 'warning' | 'info'
  message: string
  phase: string
}

interface HeaderAudit {
  url: string
  headers: Record<string, string | null>
  issues: AuditIssue[]
}

interface BrowserCacheTiming {
  url: string
  firstLoadMs: number
  secondLoadMs: number
  speedup: number
  cached: boolean
}

interface BrowserCacheAudit {
  timings: BrowserCacheTiming[]
  cacheHitRate: number
  issues: AuditIssue[]
}

interface SWCacheEntry {
  cacheName: string
  totalRequests: number
  imageRequests: number
  urls: string[]
}

interface SWCacheAudit {
  supported: boolean
  caches: SWCacheEntry[]
  totalCachedImages: number
  issues: AuditIssue[]
}

interface NetworkEntry {
  url: string
  timestamp: number
  cached: boolean
}

interface NetworkAudit {
  totalFetches: number
  uniqueImages: number
  duplicates: { url: string; count: number }[]
  issues: AuditIssue[]
}

interface ServerConfigAudit {
  url: string
  headers: Record<string, string | null>
  issues: AuditIssue[]
}

interface CachingAuditReport {
  timestamp: string
  phases: {
    headers: HeaderAudit
    browserCache: BrowserCacheAudit
    swCache: SWCacheAudit
    network: NetworkAudit
    serverConfig: ServerConfigAudit
  }
  allIssues: AuditIssue[]
  severity: 'OK' | 'WARNING' | 'CRITICAL'
}

// ---------------------------------------------------------------------------
// Phase 1: Check HTTP headers for a sample image
// ---------------------------------------------------------------------------

async function auditImageHeaders(sampleUrls: string[]): Promise<HeaderAudit> {
  const issues: AuditIssue[] = []
  const url = sampleUrls[0]
  let headers: Record<string, string | null> = {}

  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    headers = {
      cacheControl: res.headers.get('cache-control'),
      etag: res.headers.get('etag'),
      lastModified: res.headers.get('last-modified'),
      contentType: res.headers.get('content-type'),
      contentLength: res.headers.get('content-length'),
      expires: res.headers.get('expires'),
      vary: res.headers.get('vary'),
      xVercelCache: res.headers.get('x-vercel-cache'),
      xVercelId: res.headers.get('x-vercel-id'),
    }

    if (!headers.cacheControl) {
      issues.push({ severity: 'error', message: 'Missing Cache-Control header', phase: 'headers' })
    } else if (headers.cacheControl.includes('no-store')) {
      issues.push({ severity: 'error', message: `Cache-Control: ${headers.cacheControl} — disables all caching`, phase: 'headers' })
    } else if (headers.cacheControl.includes('no-cache')) {
      issues.push({ severity: 'warning', message: `Cache-Control: ${headers.cacheControl} — revalidates on every request`, phase: 'headers' })
    } else if (!headers.cacheControl.includes('max-age') && !headers.cacheControl.includes('immutable')) {
      issues.push({ severity: 'warning', message: 'Cache-Control missing max-age or immutable — cache duration unclear', phase: 'headers' })
    }

    if (!headers.etag && !headers.lastModified) {
      issues.push({ severity: 'warning', message: 'No ETag or Last-Modified — conditional requests (304) won\'t work', phase: 'headers' })
    }

    if (!headers.contentType?.startsWith('image/')) {
      issues.push({ severity: 'info', message: `Content-Type is ${headers.contentType} — expected image/*`, phase: 'headers' })
    }
  } catch (err: any) {
    issues.push({ severity: 'error', message: `Failed to fetch image: ${err.message}`, phase: 'headers' })
  }

  return { url, headers, issues }
}

// ---------------------------------------------------------------------------
// Phase 2: Measure browser disk cache effectiveness
// ---------------------------------------------------------------------------

async function auditBrowserCache(sampleUrls: string[]): Promise<BrowserCacheAudit> {
  const timings: BrowserCacheTiming[] = []
  const issues: AuditIssue[] = []

  for (const url of sampleUrls) {
    try {
      // First load — bypass cache
      const t1Start = performance.now()
      const res1 = await fetch(url, { cache: 'no-store' })
      await res1.blob()
      const t1End = performance.now()

      // Small delay
      await new Promise(r => setTimeout(r, 200))

      // Second load — use default cache
      const t2Start = performance.now()
      const res2 = await fetch(url)
      await res2.blob()
      const t2End = performance.now()

      const firstLoad = t1End - t1Start
      const secondLoad = t2End - t2Start
      const speedup = firstLoad / Math.max(secondLoad, 1)
      const cached = speedup > 1.5 || secondLoad < 50

      timings.push({
        url,
        firstLoadMs: Math.round(firstLoad),
        secondLoadMs: Math.round(secondLoad),
        speedup: Math.round(speedup * 10) / 10,
        cached,
      })

      if (!cached) {
        issues.push({
          severity: 'warning',
          message: `Image not cached — first: ${Math.round(firstLoad)}ms, second: ${Math.round(secondLoad)}ms`,
          phase: 'browserCache',
        })
      }
    } catch {
      // Skip failed fetches
    }
  }

  const cacheHitRate = timings.length > 0
    ? timings.filter(t => t.cached).length / timings.length
    : 0

  return { timings, cacheHitRate, issues }
}

// ---------------------------------------------------------------------------
// Phase 3: Service Worker cache storage audit
// ---------------------------------------------------------------------------

async function auditServiceWorkerCache(): Promise<SWCacheAudit> {
  const issues: AuditIssue[] = []

  if (!('caches' in window)) {
    issues.push({ severity: 'error', message: 'Cache Storage API not available', phase: 'swCache' })
    return { supported: false, caches: [], totalCachedImages: 0, issues }
  }

  const cacheNames = await caches.keys()
  const caches_: SWCacheEntry[] = []
  let totalCachedImages = 0

  for (const name of cacheNames) {
    const cache = await caches.open(name)
    const keys = await cache.keys()
    const imageKeys = keys.filter(r =>
      r.url.includes('/api/photos')
      || r.url.includes('/api/blob')
      || r.url.includes('/api/blob')
      || r.url.includes('/_vercel/image')
      || r.url.includes('/image'),
    )

    caches_.push({
      cacheName: name,
      totalRequests: keys.length,
      imageRequests: imageKeys.length,
      urls: imageKeys.slice(0, 10).map(r => r.url), // First 10 for inspection
    })

    totalCachedImages += imageKeys.length
  }

  if (cacheNames.length === 0) {
    issues.push({ severity: 'warning', message: 'No Service Worker caches found', phase: 'swCache' })
  }

  return { supported: true, caches: caches_, totalCachedImages, issues }
}

// ---------------------------------------------------------------------------
// Phase 4: Network activity analysis (intercept fetches)
// ---------------------------------------------------------------------------

async function auditNetworkActivity(durationMs = 10000): Promise<NetworkAudit> {
  const issues: AuditIssue[] = []
  const log: NetworkEntry[] = []
  const originalFetch = window.fetch

  // @ts-ignore — monkey-patching fetch
  window.fetch = function (...args: Parameters<typeof fetch>) {
    const [input] = args
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
    const isImage = url.includes('/api/photos')
      || url.includes('/api/blob')
      || url.includes('/_vercel/image')

    if (isImage) {
      const cacheHeader = typeof input === 'object' && input instanceof Request
        ? input.headers.get('cache-control')
        : null
      log.push({
        url: url.split('?')[0], // Normalize — strip query params
        timestamp: Date.now(),
        cached: cacheHeader === 'only-if-cached',
      })
    }

    return originalFetch.apply(this, args)
  }

  await new Promise(r => setTimeout(r, durationMs))

  // Restore
  window.fetch = originalFetch

  // Analyze duplicates
  const urlCounts: Record<string, number> = {}
  for (const entry of log) {
    urlCounts[entry.url] = (urlCounts[entry.url] || 0) + 1
  }

  const duplicates = Object.entries(urlCounts)
    .filter(([_, count]) => count > 1)
    .map(([url, count]) => ({ url, count }))

  if (duplicates.length > 0) {
    issues.push({
      severity: 'warning',
      message: `${duplicates.length} image(s) fetched multiple times in ${Math.round(durationMs / 1000)}s`,
      phase: 'network',
    })
  }

  return {
    totalFetches: log.length,
    uniqueImages: Object.keys(urlCounts).length,
    duplicates,
    issues,
  }
}

// ---------------------------------------------------------------------------
// Phase 5: Server configuration audit (HEAD request with detail)
// ---------------------------------------------------------------------------

async function auditServerConfiguration(sampleUrls: string[]): Promise<ServerConfigAudit> {
  const issues: AuditIssue[] = []
  const url = sampleUrls[0]
  let headers: Record<string, string | null> = {}

  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    headers = {
      cacheControl: res.headers.get('cache-control'),
      contentLength: res.headers.get('content-length'),
      contentType: res.headers.get('content-type'),
      etag: res.headers.get('etag'),
      lastModified: res.headers.get('last-modified'),
      expires: res.headers.get('expires'),
      age: res.headers.get('age'),
      xVercelCache: res.headers.get('x-vercel-cache'),
      xVercelId: res.headers.get('x-vercel-id'),
      cdnCacheControl: res.headers.get('cdn-cache-control'),
      xCache: res.headers.get('x-cache'),
    }

    if (!headers.cacheControl) {
      issues.push({ severity: 'error', message: 'No Cache-Control header — images won\'t cache anywhere', phase: 'serverConfig' })
    } else if (headers.cacheControl.includes('no-store') || headers.cacheControl.includes('no-cache')) {
      issues.push({ severity: 'error', message: `Cache-Control: ${headers.cacheControl} — disables caching`, phase: 'serverConfig' })
    }

    if (headers.age === '0') {
      issues.push({ severity: 'info', message: 'Age: 0 — image not cached at CDN edge', phase: 'serverConfig' })
    }

    // Check for presigned URL patterns (unique query params = no cache)
    if (url.includes('token=') || url.includes('X-Amz') || url.includes('sig=')) {
      issues.push({
        severity: 'error',
        message: 'URL contains presigned token — each URL is unique, browser/CDN cannot cache across page loads',
        phase: 'serverConfig',
      })
    }
  } catch (err: any) {
    issues.push({ severity: 'error', message: `Failed to fetch: ${err.message}`, phase: 'serverConfig' })
  }

  return { url, headers, issues }
}

// ---------------------------------------------------------------------------
// Main audit runner
// ---------------------------------------------------------------------------

export async function runCachingAudit(sampleImageUrls?: string[]): Promise<CachingAuditReport> {
  // Use provided URLs or fetch the feed to get sample URLs
  let urls = sampleImageUrls

  if (!urls || urls.length === 0) {
    try {
      const feed = await $fetch<{ photos: { url: string }[] }>('/api/photos?limit=5')
      urls = feed.photos.map(p => p.url).filter(Boolean)
    } catch {
      // Fallback — can't fetch feed (not authenticated?)
      urls = []
    }
  }

  const sampleUrls = (urls || []).slice(0, 3)

  const report: CachingAuditReport = {
    timestamp: new Date().toISOString(),
    phases: {
      headers: { url: '', headers: {}, issues: [] },
      browserCache: { timings: [], cacheHitRate: 0, issues: [] },
      swCache: { supported: false, caches: [], totalCachedImages: 0, issues: [] },
      network: { totalFetches: 0, uniqueImages: 0, duplicates: [], issues: [] },
      serverConfig: { url: '', headers: {}, issues: [] },
    },
    allIssues: [],
    severity: 'OK',
  }

  if (sampleUrls.length === 0) {
    report.allIssues = [{ severity: 'error', message: 'No sample images available — are you logged in?', phase: 'setup' }]
    report.severity = 'CRITICAL'
    return report
  }

  // Phase 1: Headers
  report.phases.headers = await auditImageHeaders(sampleUrls)

  // Phase 2: Browser cache
  report.phases.browserCache = await auditBrowserCache(sampleUrls)

  // Phase 3: SW cache
  report.phases.swCache = await auditServiceWorkerCache()

  // Phase 4: Network (10s observation)
  report.phases.network = await auditNetworkActivity(10_000)

  // Phase 5: Server config
  report.phases.serverConfig = await auditServerConfiguration(sampleUrls)

  // Aggregate
  report.allIssues = [
    ...report.phases.headers.issues,
    ...report.phases.browserCache.issues,
    ...report.phases.swCache.issues,
    ...report.phases.network.issues,
    ...report.phases.serverConfig.issues,
  ]

  const errors = report.allIssues.filter(i => i.severity === 'error').length
  const warnings = report.allIssues.filter(i => i.severity === 'warning').length

  report.severity = errors > 0 ? 'CRITICAL' : warnings > 0 ? 'WARNING' : 'OK'

  return report
}
