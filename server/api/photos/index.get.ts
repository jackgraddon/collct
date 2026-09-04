import { db, schema } from '~~/server/utils/db'
import { desc, lt, gt, eq, and, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id

  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 20, 50)
  const before = query.before ? Number(query.before) : null
  const after = query.after ? Number(query.after) : null

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
      blobPathname: schema.photos.blobPathname,
      isMoment: schema.photos.isMoment,
      momentCapturedAt: schema.photos.momentCapturedAt,
      createdAt: schema.photos.createdAt,
      user: {
        id: schema.users.id,
        username: schema.users.username,
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
        after ? gt(schema.photos.createdAt, new Date(after)) : undefined,
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

  // Deduplicate avatar presigning — same user may appear multiple times
  const uniqueAvatarPaths = new Set<string>()
  for (const row of rows) {
    if (row.user.avatarUrl) uniqueAvatarPaths.add(row.user.avatarUrl)
  }
  const avatarUrlMap = new Map<string, string>()
  await Promise.all(
    [...uniqueAvatarPaths].map(async (pathname) => {
      avatarUrlMap.set(pathname, await getBlobUrl(pathname))
    }),
  )

  // Presign photo URLs and resolve avatars from the deduped map
  const photos = await Promise.all(
    rows.map(async (row) => {
      const url = await getBlobUrl(row.blobPathname)
      const avatarUrl = row.user.avatarUrl
        ? avatarUrlMap.get(row.user.avatarUrl) ?? row.user.avatarUrl
        : null
      const groups = groupsMap.get(row.id) ?? []

      return {
        ...row,
        url,
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
