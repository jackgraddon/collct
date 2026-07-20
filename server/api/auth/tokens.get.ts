import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId: number = session.user.id

  const tokens = await db
    .select({
      id: schema.apiTokens.id,
      name: schema.apiTokens.name,
      createdAt: schema.apiTokens.createdAt,
      lastUsedAt: schema.apiTokens.lastUsedAt,
      expiresAt: schema.apiTokens.expiresAt,
    })
    .from(schema.apiTokens)
    .where(eq(schema.apiTokens.userId, userId))

  return { tokens }
})
