import { z } from 'zod'
import { eq, and, isNull } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const { user: sessionUser } = await requireUserSession(event)
  const userId = sessionUser.id

  const body = await readValidatedBody(event, body => z.object({
    token: z.string().length(6).regex(/^\d+$/).optional(),
    recoveryCode: z.string().min(10).optional(),
  }).parse(body))

  if (!body.token && !body.recoveryCode) {
    throw createError({ statusCode: 400, statusMessage: 'TOTP token or recovery code is required' })
  }

  const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).then(r => r[0])
  if (!user || !user.totpEnabled) {
    throw createError({ statusCode: 400, statusMessage: 'TOTP is not enabled' })
  }

  const totpRow = await db.select().from(schema.totpSecrets).where(eq(schema.totpSecrets.userId, userId)).then(r => r[0])
  if (!totpRow) throw createError({ statusCode: 400, statusMessage: 'TOTP secret not found' })

  let verified = false

  if (body.token) {
    verified = verifyTotpToken(totpRow.secret, body.token)
  } else if (body.recoveryCode) {
    const normalised = normaliseCode(body.recoveryCode)
    const hash = hashRecoveryCode(normalised)
    const [match] = await db.select().from(schema.recoveryCodes)
      .where(
        and(
          eq(schema.recoveryCodes.userId, userId),
          eq(schema.recoveryCodes.codeHash, hash),
          isNull(schema.recoveryCodes.usedAt)
        )
      )
      .limit(1)
    
    if (match) {
      verified = true
      await db.update(schema.recoveryCodes).set({ usedAt: new Date() }).where(eq(schema.recoveryCodes.id, match.id))
    }
  }

  if (!verified) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid TOTP token or recovery code' })
  }

  await db.transaction(async (tx) => {
    await tx.delete(schema.totpSecrets).where(eq(schema.totpSecrets.userId, userId))
    await tx.update(schema.users).set({ totpEnabled: false }).where(eq(schema.users.id, userId))
  })

  // Update session to reflect MFA status
  await setUserSession(event, {
    user: {
      ...sessionUser,
      totpEnabled: false
    }
  })

  return { ok: true }
})