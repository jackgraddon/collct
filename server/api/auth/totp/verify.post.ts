import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { token } = await readValidatedBody(event, z.object({
    token: z.string().length(6).regex(/^\d+$/),
  }).parse)

  const userId = session.user.id
  const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).then(r => r[0])
  if (!user) throw createError({ statusCode: 401 })

  const totpRow = await db.select().from(schema.totpSecrets)
    .where(
      and(
        eq(schema.totpSecrets.userId, user.id),
        eq(schema.totpSecrets.verified, false)
      )
    ).then(r => r[0])
    
  if (!totpRow) throw createError({ statusCode: 400, statusMessage: 'No pending TOTP setup' })

  const valid = verifyTotpToken(totpRow.secret, token)
  if (!valid) throw createError({ statusCode: 400, statusMessage: 'Invalid code' })

  await db.transaction(async (tx) => {
    await tx.update(schema.totpSecrets)
      .set({ verified: true, enabledAt: new Date() })
      .where(eq(schema.totpSecrets.userId, user.id))
    
    await tx.update(schema.users)
      .set({ totpEnabled: true })
      .where(eq(schema.users.id, user.id))
  })

  return { ok: true }
})
