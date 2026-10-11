import { eq } from 'drizzle-orm'
import { db, schema } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id
  
  const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).then(r => r[0])
  if (!user) throw createError({ statusCode: 401, statusMessage: 'User not found' })

  const codes = generateRecoveryCodes(10)

  // Atomically replace all codes for this user
  await db.transaction(async (tx) => {
    await tx.delete(schema.recoveryCodes).where(eq(schema.recoveryCodes.userId, user.id))
    
    for (const code of codes) {
      const hash = hashRecoveryCode(code)
      await tx.insert(schema.recoveryCodes).values({
        userId: user.id,
        codeHash: hash,
      })
    }
    
    await tx.update(schema.users)
      .set({ recoveryCodesGeneratedAt: new Date() })
      .where(eq(schema.users.id, user.id))
  })

  // Return plaintext codes ONCE — never stored, never returned again
  return { codes }
})
