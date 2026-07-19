import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { hashApiToken } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (session?.user) return

  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) return

  const rawToken = authHeader.slice(7)
  if (!rawToken) return

  const tokenHash = hashApiToken(rawToken)

  const row = await db.query.apiTokens.findFirst({
    where: eq(schema.apiTokens.tokenHash, tokenHash),
  })

  if (!row) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or revoked token' })
  }

  if (row.expiresAt && row.expiresAt < new Date()) {
    throw createError({ statusCode: 401, statusMessage: 'Token expired' })
  }

  await db
    .update(schema.apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiTokens.id, row.id))

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, row.userId),
  })

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'User not found' })
  }

  const toursCompleted: string[] = user.toursCompleted
    ? JSON.parse(user.toursCompleted)
    : []

  await setUserSession(event, {
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      totpEnabled: user.totpEnabled ?? false,
      hasSeenOobe: toursCompleted.includes('oobe-v1'),
    },
    loggedInAt: Date.now(),
  })
})
