import { db, schema } from '~~/server/utils/db'
import { eq, and, gt } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  device_code: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  rateLimit(`device:poll:${getClientIp(event)}`, RATE_LIMITS.devicePoll)

  const body = await readValidatedBody(event, bodySchema.parse)

  const deviceCodeHashed = hashDeviceCode(body.device_code)

  const auth = await db.query.pendingAuthorizations.findFirst({
    where: and(
      eq(schema.pendingAuthorizations.deviceCodeHash, deviceCodeHashed),
      eq(schema.pendingAuthorizations.type, 'device'),
      eq(schema.pendingAuthorizations.status, 'pending'),
      gt(schema.pendingAuthorizations.expiresAt, new Date()),
    ),
  })

  if (!auth) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid, expired, or already used device code' })
  }

  if (auth.status === 'approved' && auth.userId) {
    // Generate token and return it
    const { raw, hash } = createApiToken()
    const tokenName = auth.appName || 'Device Auth'

    const [token] = await db
      .insert(schema.apiTokens)
      .values({
        userId: auth.userId,
        name: tokenName,
        tokenHash: hash,
      })
      .returning()

    // Clean up the pending authorization
    await db.delete(schema.pendingAuthorizations).where(eq(schema.pendingAuthorizations.id, auth.id))

    return {
      token: raw,
      token_type: 'Bearer',
      expires_in: null,
    }
  }

  if (auth.status === 'denied') {
    await db.delete(schema.pendingAuthorizations).where(eq(schema.pendingAuthorizations.id, auth.id))
    throw createError({ statusCode: 400, statusMessage: 'Authorization denied by user' })
  }

  // Still pending
  return { status: 'pending' }
})
