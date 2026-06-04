import { eq } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  avatarUrl: z.string().max(500).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  
  const body = await readBody(event)
  const result = updateSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid input',
      data: result.error.flatten(),
    })
  }

  const data = result.data

  if (Object.keys(data).length === 0) {
    return { success: true }
  }

  const [updated] = await db
    .update(schema.users)
    .set(data)
    .where(eq(schema.users.id, user.id))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  // Reseal the session with fresh values
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
