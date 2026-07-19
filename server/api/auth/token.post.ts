import { db, schema } from '@nuxthub/db'
import { eq, and, gt } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  code: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  rateLimit(`token:exchange:${getClientIp(event)}`, RATE_LIMITS.tokenExchange)

  const body = await readValidatedBody(event, bodySchema.parse)

  const auth = await db.query.pendingAuthorizations.findFirst({
    where: and(
      eq(schema.pendingAuthorizations.authorizationCode, body.code),
      eq(schema.pendingAuthorizations.type, 'authorization_code'),
      eq(schema.pendingAuthorizations.status, 'approved'),
      gt(schema.pendingAuthorizations.expiresAt, new Date()),
    ),
  })

  if (!auth || !auth.userId) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid, expired, or unused authorization code' })
  }

  // Generate token
  const { raw, hash } = createApiToken()
  const tokenName = auth.appName || 'Browser Auth'

  const [token] = await db
    .insert(schema.apiTokens)
    .values({
      userId: auth.userId,
      name: tokenName,
      tokenHash: hash,
    })
    .returning()

  // Clean up
  await db.delete(schema.pendingAuthorizations).where(eq(schema.pendingAuthorizations.id, auth.id))

  return {
    access_token: raw,
    token_type: 'Bearer',
    expires_in: null,
  }
})
