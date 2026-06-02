import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { presignUrl } from '@vercel/blob'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid photo ID' })
  }

  const [row] = await db
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
    .where(eq(schema.photos.id, id))
    .limit(1)

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  }

  const token = await getDelegationToken()
  
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