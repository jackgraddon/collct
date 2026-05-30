import { db, schema } from '@nuxthub/db'
import { blob } from 'hub:blob'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const form = await readFormData(event)
  const file = form.get('file') as File

  const uploaded = await blob.put(`photos/${user.id}/${file.name}`, file, {
    contentType: file.type,
  })

  const [photo] = await db.insert(schema.photos).values({
    userId: user.id,
    blobPathname: uploaded.pathname,
  }).returning()

  return photo
})