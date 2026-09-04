import { db, schema } from '~~/server/utils/db'
import { desc, eq, and, sql, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId: number = session.user.id

  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 20, 50)
  const before = query.before ? Number(query.before) : null

  // Build base conditions
  const conditions = [
    eq(schema.notifications.userId, userId),
    sql`${schema.notifications.dismissedAt} IS NULL`,
  ]
  if (before) {
    conditions.push(sql`${schema.notifications.id} < ${before}`)
  }

  // Fetch notifications with actor info
  const rows = await db
    .select({
      id: schema.notifications.id,
      type: schema.notifications.type,
      isRead: schema.notifications.isRead,
      photoId: schema.notifications.photoId,
      commentId: schema.notifications.commentId,
      groupId: schema.notifications.groupId,
      createdAt: schema.notifications.createdAt,
      actor: {
        id: schema.users.id,
        name: schema.users.name,
        username: schema.users.username,
        avatarUrl: schema.users.avatarUrl,
      },
    })
    .from(schema.notifications)
    .innerJoin(schema.users, eq(schema.users.id, schema.notifications.actorId))
    .where(and(...conditions))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(limit + 1) // fetch one extra to check if there's more

  const hasMore = rows.length > limit
  const sliced = hasMore ? rows.slice(0, limit) : rows

  // Batch-resolve avatar URLs
  const uniqueAvatarPaths = new Set<string>()
  for (const row of sliced) {
    if (row.actor.avatarUrl) uniqueAvatarPaths.add(row.actor.avatarUrl)
  }
  const avatarUrlMap = new Map<string, string>()
  await Promise.all(
    [...uniqueAvatarPaths].map(async (pathname) => {
      avatarUrlMap.set(pathname, await getBlobUrl(pathname))
    }),
  )

  const notifications = sliced.map((row) => ({
    ...row,
    actor: {
      ...row.actor,
      avatarUrl: row.actor.avatarUrl
        ? avatarUrlMap.get(row.actor.avatarUrl) ?? row.actor.avatarUrl
        : null,
    },
  }))

  // Resolve photo thumbnail URLs for photo-related notifications
  const photoIds = [...new Set(notifications.filter((n) => n.photoId).map((n) => n.photoId!))]
  const photoUrlMap = new Map<number, string>()
  if (photoIds.length) {
    const photoRows = await db
      .select({ id: schema.photos.id, blobPathname: schema.photos.blobPathname })
      .from(schema.photos)
      .where(inArray(schema.photos.id, photoIds))
    await Promise.all(
      photoRows.map(async (p) => {
        photoUrlMap.set(p.id, await getBlobUrl(p.blobPathname))
      }),
    )
  }

  const result = notifications.map((n) => ({
    ...n,
    groupId: n.groupId ? JSON.parse(n.groupId) as number[] : [],
    photoUrl: n.photoId ? photoUrlMap.get(n.photoId) ?? null : null,
  }))

  const lastRow = sliced[sliced.length - 1]
  const nextCursor = hasMore && lastRow ? lastRow.id : null

  return { notifications: result, nextCursor }
})
