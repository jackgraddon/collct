import { eq } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'
import { blob } from 'hub:blob'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 2 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const form = await readFormData(event)
  const file = form.get('file') as File | null

  if (!file || file.size === 0)
    throw createError({ statusCode: 400, statusMessage: 'No file provided' })
  if (!ALLOWED_TYPES.includes(file.type))
    throw createError({ statusCode: 415, statusMessage: 'Unsupported file type' })
  if (file.size > MAX_BYTES)
    throw createError({ statusCode: 413, statusMessage: 'File too large. Maximum size is 2MB.' })

  // Delete old avatar if exists
  if (user.avatarUrl) {
    // Use the stored pathname to delete
    await blob.delete(user.avatarUrl).catch((err) => {
      console.error("Failed to delete old avatar:", err)
    })
  }

  const ext = file.type.split('/')[1]!.replace('jpeg', 'jpg')
  const blobPathname = `avatars/${user.id}-${Date.now()}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  await blob.put(blobPathname, arrayBuffer, {
    contentType: file.type,
    addRandomSuffix: false,
  })

  const [updated] = await db
    .update(schema.users)
    .set({ avatarUrl: blobPathname })
    .where(eq(schema.users.id, user.id))
    .returning()

  if (!updated) throw createError({ statusCode: 500, statusMessage: 'Update failed' })

  await setUserSession(event, {
    user: {
      ...user,
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
    },
  })

  return { avatarUrl: updated.avatarUrl }
})