import { db, schema } from '@nuxthub/db'
import { desc, lt, eq, and, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id

  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 20, 50)
  const before = query.before ? Number(query.before) : null

  // Get IDs of photos visible to this viewer
  const visibleIds = await getVisiblePhotoIds(userId)

  if (visibleIds.length === 0) {
    return { photos: [], nextCursor: null }
  }

  // Fetch visible photos with pagination
  const rows = await db
    .select({
      id: schema.photos.id,
      caption: schema.photos.caption,
      captionEditedAt: schema.photos.captionEditedAt,
      captionHistory: schema.photos.captionHistory,
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
        inArray(schema.photos.id, visibleIds),
        before ? lt(schema.photos.createdAt, new Date(before)) : undefined,
      ),
    )
    .orderBy(desc(schema.photos.createdAt))
    .limit(limit)

  if (rows.length === 0) {
    return { photos: [], nextCursor: null }
  }

  // Batch-fetch group labels for all photos in this page
  const photoIds = rows.map((r) => r.id)
  const groupsMap = await getVisiblePhotoGroups(photoIds, userId)

  const photos = await Promise.all(
    rows.map(async (row) => {
      const url = await getBlobUrl(row.blobPathname)

      let avatarUrl = row.user.avatarUrl
      if (avatarUrl) {
        avatarUrl = await getBlobUrl(avatarUrl)
      }

      const groups = groupsMap.get(row.id) ?? []

    const captionHistory: { text: string | null; editedAt: string }[] | null = row.captionEditedAt
      ? (row.captionHistory ? JSON.parse(row.captionHistory) : null)
      : null

    return {
      ...row,
      url,
      captionHistory,
      blobPathname: undefined,
      user: { ...row.user, avatarUrl },
      groups,
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
