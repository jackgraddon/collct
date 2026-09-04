import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, schema } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  rateLimit(`totp:challenge:${getClientIp(event)}`, RATE_LIMITS.totp)

  const session = await getUserSession(event)

  // Must have a pending MFA state (unverifiedUserId)
  if (!session.unverifiedUserId) {
    throw createError({ statusCode: 401, statusMessage: 'No pending MFA challenge' })
  }

  const { token } = await readValidatedBody(event, z.object({
    token: z.string().length(6).regex(/^\d+$/),
  }).parse)

  const user = await db.select().from(schema.users).where(eq(schema.users.id, session.unverifiedUserId as unknown as number)).then(r => r[0])
  if (!user) throw createError({ statusCode: 401 })

  const totpRow = await db.select().from(schema.totpSecrets)
    .where(
      eq(schema.totpSecrets.userId, user.id)
    ).then(r => r[0])
    
  if (!totpRow || !totpRow.verified) throw createError({ statusCode: 400, statusMessage: 'TOTP not configured' })

  if (!verifyTotpToken(totpRow.secret, token)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid code' })
  }

  // Upgrade: clear unverifiedUserId, grant full session
  await setUserSession(event, {
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      totpEnabled: user.totpEnabled,
      hasSeenOobe: user.toursCompleted ? JSON.parse(user.toursCompleted).includes('oobe-v1') : false,
    },
    loggedInAt: Date.now(),
  })

  return { ok: true }
})
