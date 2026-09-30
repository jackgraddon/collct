import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, schema } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  
  const body = await readValidatedBody(event, z.object({
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().max(255).optional(),
    username: z.string().min(1).max(30).regex(/^[A-Za-z0-9._-]+$/, 'Letters, numbers, dots, underscores, and hyphens only').optional(),
  }).parse)

  const updates: Record<string, any> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.email !== undefined) updates.email = body.email
  if (body.username !== undefined) {
    const [taken] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, body.username))
      .limit(1)
    if (taken && taken.id !== user.id)
      throw createError({ statusCode: 409, statusMessage: 'Username is already taken' })
    updates.username = body.username
  }

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  const [updated] = await db
    .update(schema.users)
    .set(updates)
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
      username: updated.username,
      avatarUrl: updated.avatarUrl,
    },
  })

  return { success: true }
})