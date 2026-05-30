import { eq } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'
import { blob } from 'hub:blob'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  // Delete old avatar blob if one exists
  if (user.avatarUrl) {
    const oldPathname = new URL(user.avatarUrl).pathname
      .replace(/^\/avatars\//, '')
    await blob.delete(oldPathname).catch(() => null)
  }

  const [uploaded] = await blob.handleUpload(event, {
    formKey: 'file',
    multiple: false,
    ensure: {
      maxSize: '2MB',
      types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    },
    put: {
      prefix: 'avatars',
      addRandomSuffix: true,
      access: 'public',
    },
  })

  const requestUrl = getRequestURL(event)
  const avatarUrl = `${requestUrl.origin}/avatars/${uploaded.pathname}`

  const [updated] = await db
    .update(schema.users)
    .set({ avatarUrl })
    .where(eq(schema.users.id, user.id))
    .returning()

  await setUserSession(event, {
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
    },
  })

  return { avatarUrl: updated.avatarUrl }
})