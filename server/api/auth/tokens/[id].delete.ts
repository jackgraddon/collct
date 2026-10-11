import { db, schema } from '~~/server/utils/db'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId: number = session.user.id

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Token ID is required' })
  }

  const [deleted] = await db
    .delete(schema.apiTokens)
    .where(
      and(
        eq(schema.apiTokens.id, id),
        eq(schema.apiTokens.userId, userId),
      ),
    )
    .returning()

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Token not found' })
  }

  return { success: true }
})
