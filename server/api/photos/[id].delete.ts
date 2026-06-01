import { db, schema } from '@nuxthub/db'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid photo ID' })
  }

  // Fetch first to verify ownership and get the blob path
  const [photo] = await db
    .select({ id: schema.photos.id, blobPathname: schema.photos.blobPathname, userId: schema.photos.userId })
    .from(schema.photos)
    .where(eq(schema.photos.id, id))
    .limit(1)

  if (!photo) {
    throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  }
  if (photo.userId !== session.user.id) {
    throw createError({ statusCode: 403, statusMessage: 'You do not own this photo' })
  }

  // Delete DB record first — if blob delete fails, the record is still gone
  // and the orphaned blob can be cleaned up later. Reverse order risks a
  // dangling DB row pointing to a deleted blob.
  await db
    .delete(schema.photos)
    .where(and(eq(schema.photos.id, id), eq(schema.photos.userId, session.user.id)))

  await hubBlob().delete(photo.blobPathname)

  return { success: true }
})
