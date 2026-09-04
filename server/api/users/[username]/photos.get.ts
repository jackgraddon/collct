import { db, schema } from '~~/server/utils/db'
import { eq, and, lt, desc, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const viewerId = session.user.id
  const username = getRouterParam(event, 'username')

  if (!username) {
    throw createError({ statusCode: 400, statusMessage: 'Username required' })
  }

  const profileUser = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .then((rows) => rows[0])

  if (!profileUser) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 20, 50)
  const before = query.before ? Number(query.before) : null

  const visibleIds = await getVisiblePhotoIds(viewerId)

  if (visibleIds.length === 0) {
    return { photos: [], nextCursor: null }
  }

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
        eq(schema.photos.userId, profileUser.id),
        inArray(schema.photos.id, visibleIds),
        before ? lt(schema.photos.createdAt, new Date(before)) : undefined,
      ),
    )
    .orderBy(desc(schema.photos.createdAt))
    .limit(limit + 1)

  if (rows.length === 0) {
    return { photos: [], nextCursor: null }
  }

  const hasMore = rows.length > limit
  if (hasMore) {
    rows.pop()
  }

  const photoIds = rows.map((r) => r.id)
  const groupsMap = await getVisiblePhotoGroups(photoIds, viewerId)

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

  const photos = await Promise.all(
    rows.map(async (row) => {
      const url = await getBlobUrl(row.blobPathname)
      const avatarUrl = row.user.avatarUrl
        ? avatarUrlMap.get(row.user.avatarUrl) ?? row.user.avatarUrl
        : null
      const groups = groupsMap.get(row.id) ?? []

      const captionHistory: { text: string | null; editedAt: string }[] | null = row.captionEditedAt
        ? (row.captionHistory ? JSON.parse(row.captionHistory) : null)
        : null

      return {
        id: row.id,
        caption: row.caption,
        captionEditedAt: row.captionEditedAt,
        captionHistory,
        url,
        createdAt: row.createdAt,
        user: { ...row.user, avatarUrl },
        groups,
      }
    }),
  )

  const lastRow = rows[rows.length - 1]
  const nextCursor = hasMore && lastRow?.createdAt ? lastRow.createdAt.getTime() : null

  return { photos, nextCursor }
})
