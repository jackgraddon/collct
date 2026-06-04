import { eq } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id
  
  const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).then(r => r[0])
  if (!user) throw createError({ statusCode: 401 })

  const { secret, uri } = createTotpSecret(user.email)

  // Store as unverified — replaces any previous pending setup
  await db.insert(schema.totpSecrets).values({
    userId: user.id,
    secret,
    verified: false,
  }).onConflictDoUpdate({
    target: schema.totpSecrets.userId,
    set: {
      secret,
      verified: false,
      enabledAt: null
    }
  })

  // Return the URI and secret — frontend renders the QR code
  return { uri, secret }
})
