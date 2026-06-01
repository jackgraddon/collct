import { db, schema } from '@nuxthub/db'
import { desc, lt, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

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
    .where(before ? lt(schema.photos.createdAt, new Date(before)) : undefined)
    .orderBy(desc(schema.photos.createdAt))
    .limit(limit)

  const photos = rows.map((row) => ({
    ...row,
    url: `/api/blob/${row.blobPathname}`,
    blobPathname: undefined,
  }))

  const nextCursor =
    rows.length === limit
      ? rows[rows.length - 1].createdAt?.getTime() ?? null
      : null

  return { photos, nextCursor }
})
