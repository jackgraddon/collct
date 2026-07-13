import { eq, and, count as drizzleCount } from 'drizzle-orm'
import { schema } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const photoId = Number(getRouterParam(event, 'id'))
  if (isNaN(photoId)) throw createError({ statusCode: 400, message: 'Invalid photo ID' })

  const session = await getUserSession(event)
  const currentUserId: number | null = session?.user?.id ?? null

  // Resolve photo owner once
  const [photo] = await db
    .select({ userId: schema.photos.userId })
    .from(schema.photos)
    .where(eq(schema.photos.id, photoId))
    .limit(1)

  if (!photo) throw createError({ statusCode: 404, message: 'Photo not found' })

  const isOwner = currentUserId !== null && currentUserId === photo.userId

  if (event.method === 'GET') {
    const liked =
      currentUserId !== null
        ? (
            await db
              .select({ id: schema.likes.id })
              .from(schema.likes)
              .where(
                and(
                  eq(schema.likes.photoId, photoId),
                  eq(schema.likes.userId, currentUserId),
                ),
              )
              .limit(1)
          ).length > 0
        : false

    const [{ total }] = await db
      .select({ total: drizzleCount() })
      .from(schema.likes)
      .where(eq(schema.likes.photoId, photoId))

    return {
      liked,
      count: isOwner ? Number(total) : null,
    }
  }

  if (event.method === 'POST') {
    if (!currentUserId) throw createError({ statusCode: 401, message: 'Not authenticated' })

    const [existing] = await db
      .select({ id: schema.likes.id })
      .from(schema.likes)
      .where(
        and(
          eq(schema.likes.photoId, photoId),
          eq(schema.likes.userId, currentUserId),
        ),
      )
      .limit(1)

    if (existing) {
      await db.delete(schema.likes).where(eq(schema.likes.id, existing.id))
    } else {
      await db.insert(schema.likes).values({ userId: currentUserId, photoId })
    }

    const [{ total }] = await db
      .select({ total: drizzleCount() })
      .from(schema.likes)
      .where(eq(schema.likes.photoId, photoId))

    return {
      liked: !existing,
      count: isOwner ? Number(total) : null,
    }
  }

  throw createError({ statusCode: 405 })
})