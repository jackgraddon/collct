import { db, schema } from '@nuxthub/db'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 10 * 1024 * 1024 // 10MB

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  const form = await readFormData(event)
  const file = form.get('photo') as File | null
  const caption = (form.get('caption') as string | null)?.trim() || null

  if (!file || file.size === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No photo provided' })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw createError({ statusCode: 415, statusMessage: 'Unsupported file type' })
  }
  if (file.size > MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'File too large. Maximum size is 10MB.' })
  }

  const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
  // Sanitize filename — strip spaces and special chars, use timestamp + uuid suffix
  const blobPathname = `photos/${session.user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

  const arrayBuffer = await file.arrayBuffer()

  await hubBlob().put(blobPathname, arrayBuffer, {
    contentType: file.type,
    addRandomSuffix: false,
  })

  const [photo] = await db
    .insert(schema.photos)
    .values({
      userId: session.user.id,
      blobPathname,
      caption,
    })
    .returning()

  return {
    ...photo,
    url: `/api/blob/${blobPathname}`,
  }
})
