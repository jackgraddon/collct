import { db, schema } from '~~/server/utils/db'
import { eq, and, gt } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  code: z.string().min(1),
  code_verifier: z.string().min(43).max(128).optional(),
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

  // PKCE validation: if a code_challenge was stored, verify the code_verifier
  if (auth.codeChallenge) {
    if (!body.code_verifier) {
      throw createError({ statusCode: 400, statusMessage: 'code_verifier required for this authorization' })
    }
    const computed = hashCodeChallenge(body.code_verifier)
    if (computed !== auth.codeChallenge) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid code_verifier' })
    }
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
