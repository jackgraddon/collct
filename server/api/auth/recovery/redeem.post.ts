import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, z.object({
    email: z.string().email(),
    code: z.string().min(10),
  }).parse)

  const user = await db.select().from(schema.users).where(eq(schema.users.email, body.email)).then(r => r[0])
  
  if (!user) {
    // Constant-time response: don't reveal whether the email exists
    await new Promise(r => setTimeout(r, 200))
    throw createError({ statusCode: 400, statusMessage: 'Invalid recovery code' })
  }

  const normalised = normaliseCode(body.code)
  const hash = hashRecoveryCode(normalised)

  const match = await db.select().from(schema.recoveryCodes)
    .where(
      and(
        eq(schema.recoveryCodes.userId, user.id),
        eq(schema.recoveryCodes.codeHash, hash)
      )
    ).then(r => r[0])

  if (!match || match.usedAt) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid recovery code' })
  }

  // Burn the code
  await db.update(schema.recoveryCodes)
    .set({ usedAt: new Date() })
    .where(eq(schema.recoveryCodes.id, match.id))

  // Issue a recovery-scoped session — only permits passkey re-registration
  await setUserSession(event, {
    recoveryUserId: user.id,
    recoveryScope: 'passkey_registration', // checked in register.post.ts
    loggedInAt: Date.now(),
  })

  return { ok: true }
})
