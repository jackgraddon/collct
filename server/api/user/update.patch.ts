import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, schema } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  
  const { name, email } = await readValidatedBody(event, z.object({
    name: z.string().min(1).max(100),
    email: z.string().email().max(255),
  }).parse)

  const [updated] = await db
    .update(schema.users)
    .set({
      name,
      email,
    })
    .where(eq(schema.users.id, user.id))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  // Reseal the session with fresh values, preserving existing properties
  await setUserSession(event, {
    user: {
      ...user,
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
    },
  })

  return { success: true }
})