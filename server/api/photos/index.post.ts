import { db, schema } from '@nuxthub/db'
import { blob } from 'hub:blob'
import { presignUrl } from '@vercel/blob'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 10 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  const form = await readFormData(event)
  const file = form.get('photo') as File | null
  const caption = (form.get('caption') as string | null)?.trim() || null

  if (!file || file.size === 0)
    throw createError({ statusCode: 400, statusMessage: 'No photo provided' })
  if (!ALLOWED_TYPES.includes(file.type))
    throw createError({ statusCode: 415, statusMessage: 'Unsupported file type' })
  if (file.size > MAX_BYTES)
    throw createError({ statusCode: 413, statusMessage: 'File too large. Maximum size is 10MB.' })

  const ext = file.type.split('/')[1]!.replace('jpeg', 'jpg')
  const blobPathname = `photos/${session.user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  await blob.put(blobPathname, arrayBuffer, {
    contentType: file.type,
    addRandomSuffix: false,
  })

  const [photo] = await db
    .insert(schema.photos)
    .values({ userId: session.user.id, blobPathname, caption })
    .returning()

  const token = await getDelegationToken()
  const { presignedUrl } = await presignUrl(token, {
    pathname: blobPathname,
    access: 'private',
    operation: 'get',
    validUntil: Date.now() + 60 * 60 * 1000
  })

  return { ...photo, url: presignedUrl }
})
