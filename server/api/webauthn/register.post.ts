import { eq } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'

export default defineWebAuthnRegisterEventHandler({
  async validateUser(userBody) {
    if (!userBody.userName.includes('@')) {
      throw createError({ statusCode: 400, message: 'Invalid email' })
    }
    return { userName: userBody.userName }
  },
  async onSuccess(event, { credential, user }) {
    let dbUser = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, user.userName))
      .then(r => r[0])

    if (!dbUser) {
      const [newUser] = await db
        .insert(schema.users)
        .values({ name: user.userName.split('@')[0], email: user.userName })
        .returning()
      dbUser = newUser
    }

    await db.insert(schema.credentials).values({
      id: credential.id,
      userId: dbUser!.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64'),
      counter: credential.counter,
      backedUp: credential.backedUp ? 1 : 0,
      transports: JSON.stringify(credential.transports),
    })

    await setUserSession(event, {
      user: { id: dbUser!.id, name: dbUser!.name, email: dbUser!.email },
    })
  },
})