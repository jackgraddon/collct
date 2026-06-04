import { eq } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id

  await db.transaction(async (tx) => {
    await tx.delete(schema.totpSecrets).where(eq(schema.totpSecrets.userId, userId))
    await tx.update(schema.users).set({ totpEnabled: false }).where(eq(schema.users.id, userId))
  })

  return { ok: true }
})
