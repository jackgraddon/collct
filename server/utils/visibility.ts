import { db, schema } from '@nuxthub/db'
import { eq, and, sql, inArray, type SQL } from 'drizzle-orm'

/**
 * Ensure the Public group exists and return it.
 * Called on first use — creates the system Public group if missing.
 */
export async function ensurePublicGroup() {
  const [existing] = await db
    .select()
    .from(schema.groups)
    .where(eq(schema.groups.isPublic, true))
    .limit(1)

  if (existing) return existing

  const [created] = await db
    .insert(schema.groups)
    .values({ name: 'Public', slug: 'public', isPublic: true })
    .returning()

  if (!created) throw new Error('Failed to create Public group')
  return created
}

/**
 * Auto-join a user to the Public group (called on signup).
 * Idempotent — safe to call multiple times.
 */
export async function joinUserToPublic(userId: number) {
  const pub = await ensurePublicGroup()
  await db
    .insert(schema.groupMembers)
    .values({ groupId: pub.id, userId, role: 'member' })
    .onConflictDoNothing()
}

/**
 * Ensure a user is a member of the Public group.
 * Creates the group if needed. Idempotent — safe to call on every request.
 * Handles users who registered before the auto-join code was deployed.
 */
export async function ensureUserInPublicGroup(userId: number) {
  const pub = await ensurePublicGroup()
  const [existing] = await db
    .select({ id: schema.groupMembers.id })
    .from(schema.groupMembers)
    .where(
      and(
        eq(schema.groupMembers.groupId, pub.id),
        eq(schema.groupMembers.userId, userId),
      ),
    )
    .limit(1)
  if (!existing) {
    await joinUserToPublic(userId)
  }
}

// ---------------------------------------------------------------------------
// Visibility query (a): Feed — which photos can viewer `viewerId` see?
// ---------------------------------------------------------------------------

export function visiblePhotoIdsQuery(viewerId: number) {
  return db
    .selectDistinct({ photoId: schema.photoGroups.photoId })
    .from(schema.photoGroups)
    .innerJoin(
      schema.groupMembers,
      and(
        eq(schema.groupMembers.groupId, schema.photoGroups.groupId),
        eq(schema.groupMembers.userId, viewerId),
      ),
    )
}

export type VisiblePhotoIdRow = { photoId: number }

/**
 * Returns the set of photo IDs visible to the viewer.
 */
export async function getVisiblePhotoIds(viewerId: number): Promise<number[]> {
  const rows = await visiblePhotoIdsQuery(viewerId)
  return rows.map((r) => r.photoId)
}

// ---------------------------------------------------------------------------
// Visibility query (b): Per-photo labels — which groups can viewer V see
// for photo P?
// ---------------------------------------------------------------------------

export async function getVisiblePhotoGroups(
  photoIds: number[],
  viewerId: number,
): Promise<Map<number, { id: number; name: string }[]>> {
  if (photoIds.length === 0) return new Map()

  const rows = await db
    .select({
      photoId: schema.photoGroups.photoId,
      groupId: schema.groups.id,
      groupName: schema.groups.name,
    })
    .from(schema.photoGroups)
    .innerJoin(
      schema.groupMembers,
      and(
        eq(schema.groupMembers.groupId, schema.photoGroups.groupId),
        eq(schema.groupMembers.userId, viewerId),
      ),
    )
    .innerJoin(schema.groups, eq(schema.groups.id, schema.photoGroups.groupId))
    .where(inArray(schema.photoGroups.photoId, photoIds))

  const map = new Map<number, { id: number; name: string }[]>()
  for (const row of rows) {
    const groups = map.get(row.photoId) ?? []
    groups.push({ id: row.groupId, name: row.groupName })
    map.set(row.photoId, groups)
  }
  return map
}

// ---------------------------------------------------------------------------
// Visibility query (c): Can viewer V see activity by author U on photo P?
// Uses a 3-way join through photo_groups → group_members (author) ∩ group_members (viewer)
// ---------------------------------------------------------------------------

/**
 * SQL EXISTS subquery: returns true iff author and viewer share at least one
 * group on the given photo.
 */
export function groupScopedActivityExists(
  photoId: number,
  authorId: number,
  viewerId: number,
): SQL<boolean> {
  return sql<boolean>`
    EXISTS (
      SELECT 1
      FROM ${schema.photoGroups} pg
      JOIN ${schema.groupMembers} gm_author
        ON gm_author.group_id = pg.group_id AND gm_author.user_id = ${authorId}
      JOIN ${schema.groupMembers} gm_viewer
        ON gm_viewer.group_id = pg.group_id AND gm_viewer.user_id = ${viewerId}
      WHERE pg.photo_id = ${photoId}
    )
  `
}

/**
 * Check if a viewer can see comments/likes on a photo.
 * Requires that the viewer shares at least one group with the photo.
 */
export async function canViewerSeePhotoActivity(
  photoId: number,
  viewerId: number,
): Promise<boolean> {
  const pub = await ensurePublicGroup()

  const [row] = await db
    .select({ allowed: sql<boolean>`1` })
    .from(schema.photoGroups)
    .innerJoin(
      schema.groupMembers,
      and(
        eq(schema.groupMembers.groupId, schema.photoGroups.groupId),
        eq(schema.groupMembers.userId, viewerId),
      ),
    )
    .where(eq(schema.photoGroups.photoId, photoId))
    .limit(1)

  return !!row
}

/**
 * Get the IDs of photos visible to the viewer that belong to a specific user.
 * Used by GET /api/photos/user/:userId
 */
export async function getVisiblePhotosByUser(
  ownerUserId: number,
  viewerId: number,
  limit: number,
  before: Date | null,
): Promise<{ photoId: number }[]> {
  return db
    .selectDistinct({ photoId: schema.photoGroups.photoId })
    .from(schema.photoGroups)
    .innerJoin(
      schema.groupMembers,
      and(
        eq(schema.groupMembers.groupId, schema.photoGroups.groupId),
        eq(schema.groupMembers.userId, viewerId),
      ),
    )
    .innerJoin(schema.photos, eq(schema.photos.id, schema.photoGroups.photoId))
    .where(
      and(
        eq(schema.photos.userId, ownerUserId),
        before
          ? sql`${schema.photos.createdAt} < ${before}`
          : undefined,
      ),
    )
    .orderBy(sql`${schema.photos.createdAt} DESC`)
    .limit(limit)
}
