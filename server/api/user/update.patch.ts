import { eq } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const { name, email, avatarUrl } = await readBody(event)

  const [updated] = await db
    .update(schema.users)
    .set({
      name,
      email,
      ...(avatarUrl !== undefined && { avatarUrl }),
    })
    .where(eq(schema.users.id, user.id))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  // Reseal the session with fresh values
  await setUserSession(event, {
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
    },
  })

  return { success: true }
})