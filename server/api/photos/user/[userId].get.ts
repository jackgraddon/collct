import { db, schema } from '@nuxthub/db'
import { eq, and, lt, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const userId = Number(getRouterParam(event, 'userId'))
  if (!userId || isNaN(userId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid user ID' })
  }

  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 20, 50)
  const before = query.before ? Number(query.before) : null

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
        before ? lt(schema.photos.createdAt, new Date(before)) : undefined
      )
    )
    .orderBy(desc(schema.photos.createdAt))
    .limit(limit)

  const photos = rows.map((row) => ({
    ...row,
    url: `/api/blob/${row.blobPathname}`,
    blobPathname: undefined,
  }))

  const nextCursor =
    rows.length === limit
      ? (rows[rows.length - 1].createdAt as Date)?.getTime() ?? null
      : null

  return { photos, nextCursor }
})
