import { db, schema } from '@nuxthub/db'
import { eq, and, lt, desc, inArray } from 'drizzle-orm'
import { presignUrl } from '@vercel/blob'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const viewerId = session.user.id

  const userId = Number(getRouterParam(event, 'userId'))
  if (!userId || isNaN(userId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid user ID' })
  }

  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 20, 50)
  const before = query.before ? Number(query.before) : null

  // Get all photos visible to the viewer
  const visibleIds = await getVisiblePhotoIds(viewerId)

  if (visibleIds.length === 0) {
    return { photos: [], nextCursor: null }
  }

  // Fetch visible photos by this user
  const rows = await db
    .select({
      id: schema.photos.id,
      caption: schema.photos.caption,
      blobPathname: schema.photos.blobPathname,
      createdAt: schema.photos.createdAt,
      user: {
        id: schema.users.id,
        name: schema.users.name,
        avatarUrl: schema.users.avatarUrl,
      },
    })
    .from(schema.photos)
    .innerJoin(schema.users, eq(schema.photos.userId, schema.users.id))
    .where(
      and(
        eq(schema.photos.userId, userId),
        inArray(schema.photos.id, visibleIds),
        before ? lt(schema.photos.createdAt, new Date(before)) : undefined,
      ),
    )
    .orderBy(desc(schema.photos.createdAt))
    .limit(limit)

  if (rows.length === 0) {
    return { photos: [], nextCursor: null }
  }

  const token = await getDelegationToken()

  const photos = await Promise.all(
    rows.map(async (row) => {
      const { presignedUrl: signedPhotoUrl } = await presignUrl(token, {
        pathname: row.blobPathname,
        access: 'private',
        operation: 'get',
        validUntil: Date.now() + 60 * 60 * 1000,
      })

      return {
        ...row,
        url: signedPhotoUrl,
        blobPathname: undefined,
      }
    }),
  )

  const lastRow = rows[rows.length - 1]
  const nextCursor =
    rows.length === limit && lastRow?.createdAt
      ? lastRow.createdAt.getTime()
      : null

  return { photos, nextCursor }
})
