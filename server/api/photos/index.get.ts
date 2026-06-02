import { db, schema } from '@nuxthub/db'
import { desc, lt, eq } from 'drizzle-orm'
import { presignUrl } from '@vercel/blob'

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

  if (rows.length === 0) {
    return { photos: [], nextCursor: null }
  }

  const token = await getDelegationToken()

  const photos = rows.map((row) => {
    const signedUrl = presignUrl(token, {
      pathname: row.blobPathname,
      operation: 'get',
      access: 'private',
      validUntil: Date.now() + 60 * 60 * 1000 
    })

    return {
      ...row,
      url: signedUrl,
      blobPathname: undefined,
    }
  })

  // Fallback handling if rows object is evaluated as optional
  const lastRow = rows[rows.length - 1]
  const nextCursor =
    rows.length === limit && lastRow?.createdAt
      ? lastRow.createdAt.getTime()
      : null

  return { photos, nextCursor }
})