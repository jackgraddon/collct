import { db, schema } from '@nuxthub/db'
import { eq, and, sql, count as drizzleCount } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const photoId = Number(getRouterParam(event, 'id'))
  if (isNaN(photoId)) throw createError({ statusCode: 400, statusMessage: 'Invalid photo ID' })

  const session = await getUserSession(event)
  const viewerId: number | null = session?.user?.id ?? null

  // Verify photo exists
  const [photo] = await db
    .select({ id: schema.photos.id, userId: schema.photos.userId })
    .from(schema.photos)
    .where(eq(schema.photos.id, photoId))
    .limit(1)

  if (!photo) throw createError({ statusCode: 404, statusMessage: 'Photo not found' })

  if (event.method === 'GET') {
    // Check if viewer can see likes on this photo
    if (viewerId === null) {
      return { liked: false, count: null }
    }

    // Viewer-scoped like count: only count likes where the liker and viewer share a group on this photo
    const [countResult] = await db
      .select({ total: drizzleCount() })
      .from(schema.likes)
      .innerJoin(
        schema.photoGroups,
        eq(schema.photoGroups.photoId, schema.likes.photoId),
      )
      .innerJoin(
        schema.groupMembers,
        and(
          eq(schema.groupMembers.groupId, schema.photoGroups.groupId),
          eq(schema.groupMembers.userId, viewerId),
        ),
      )
      .where(
        and(
          eq(schema.likes.photoId, photoId),
          sql`EXISTS (
            SELECT 1
            FROM ${schema.photoGroups} pg2
            JOIN ${schema.groupMembers} gm_liker
              ON gm_liker.group_id = pg2.group_id AND gm_liker.user_id = ${schema.likes.userId}
            WHERE pg2.photo_id = ${photoId}
          )`,
        ),
      )

    const totalCount = countResult ? Number(countResult.total) : 0

    // Did the current viewer like this photo?
    const [viewerLike] = await db
      .select({ id: schema.likes.id })
      .from(schema.likes)
      .innerJoin(
        schema.photoGroups,
        eq(schema.photoGroups.photoId, schema.likes.photoId),
      )
      .innerJoin(
        schema.groupMembers,
        and(
          eq(schema.groupMembers.groupId, schema.photoGroups.groupId),
          eq(schema.groupMembers.userId, viewerId),
        ),
      )
      .where(
        and(
          eq(schema.likes.photoId, photoId),
          eq(schema.likes.userId, viewerId),
        ),
      )
      .limit(1)

    return {
      liked: !!viewerLike,
      count: totalCount,
    }
  }

  if (event.method === 'POST') {
    if (!viewerId) throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })

    // Check viewer can see this photo's groups
    const [viewerMembership] = await db
      .select({ id: schema.groupMembers.id })
      .from(schema.groupMembers)
      .innerJoin(
        schema.photoGroups,
        and(
          eq(schema.photoGroups.groupId, schema.groupMembers.groupId),
          eq(schema.photoGroups.photoId, photoId),
        ),
      )
      .where(eq(schema.groupMembers.userId, viewerId))
      .limit(1)

    if (!viewerMembership) {
      throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
    }

    // Toggle like
    const [existing] = await db
      .select({ id: schema.likes.id })
      .from(schema.likes)
      .where(
        and(
          eq(schema.likes.photoId, photoId),
          eq(schema.likes.userId, viewerId),
        ),
      )
      .limit(1)

    if (existing) {
      await db.delete(schema.likes).where(eq(schema.likes.id, existing.id))
      await deleteNotification({ userId: photo.userId, actorId: viewerId, type: 'like', photoId })
    } else {
      await db.insert(schema.likes).values({ userId: viewerId, photoId })
      await createNotification({ userId: photo.userId, actorId: viewerId, type: 'like', photoId })
    }

    // Re-fetch viewer-scoped count
    const [postCountResult] = await db
      .select({ total: drizzleCount() })
      .from(schema.likes)
      .innerJoin(
        schema.photoGroups,
        eq(schema.photoGroups.photoId, schema.likes.photoId),
      )
      .innerJoin(
        schema.groupMembers,
        and(
          eq(schema.groupMembers.groupId, schema.photoGroups.groupId),
          eq(schema.groupMembers.userId, viewerId),
        ),
      )
      .where(
        and(
          eq(schema.likes.photoId, photoId),
          sql`EXISTS (
            SELECT 1
            FROM ${schema.photoGroups} pg2
            JOIN ${schema.groupMembers} gm_liker
              ON gm_liker.group_id = pg2.group_id AND gm_liker.user_id = ${schema.likes.userId}
            WHERE pg2.photo_id = ${photoId}
          )`,
        ),
      )

    const postTotalCount = postCountResult ? Number(postCountResult.total) : 0

    return {
      liked: !existing,
      count: postTotalCount,
    }
  }

  throw createError({ statusCode: 405 })
})
