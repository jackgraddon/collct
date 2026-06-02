import { eq } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'
import type { H3Event } from 'h3'

export default defineWebAuthnRegisterEventHandler({
  async validateUser(userBody: any, event: H3Event) {
    // optional: protect linking to an already‑authenticated user
    const session = await getUserSession(event)
    if (session?.user?.email && session.user.email !== userBody.userName) {
      throw createError({ statusCode: 400, message: 'Email not matching current session' })
    }

    if (!userBody.userName?.includes('@')) {
      throw createError({ statusCode: 400, message: 'Invalid email' })
    }

    // Return exactly what onSuccess expects
    return { userName: userBody.userName }
  },

  async onSuccess(event: H3Event, { credential, user }: { credential: any; user: { userName: string } }) {
    // 2️⃣a️⃣ Look up existing user
    let dbUser = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, user.userName))
      .then((rows) => rows[0])

    // 2️⃣b️⃣ Create user if needed
    if (!dbUser) {
      const [newUser] = await db
        .insert(schema.users)
        .values({
          name: user.userName.split('@')[0],
          email: user.userName,
        })
        .returning()
      dbUser = newUser
    }

    // 2️⃣c️⃣ Store the new WebAuthn credential
    await db.insert(schema.credentials).values({
      id: credential.id,
      userId: dbUser!.id,
      // Either raw Uint8Array (bytea) or base64url string:
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      backedUp: credential.backedUp ? 1 : 0,
      transports: JSON.stringify(credential.transports),
    })

    // 2️⃣d️⃣ Create the session
    await setUserSession(event, {
      user: {
        id: dbUser!.id,
        name: dbUser!.name,
        email: dbUser!.email,
      },
      loggedInAt: Date.now(),
    })
  },
})