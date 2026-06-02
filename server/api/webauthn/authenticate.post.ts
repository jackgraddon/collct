import { eq } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'

export default defineWebAuthnAuthenticateEventHandler({
  async allowCredentials(event, userName) {
    if (!userName) return []

    const user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, userName))
      .then(r => r[0])

    if (!user) throw createError({ statusCode: 400, message: 'User not found' })

    const userCredentials = await db
      .select()
      .from(schema.credentials)
      .where(eq(schema.credentials.userId, user.id))

    return userCredentials.map(c => ({ id: c.id }))
  },
  async getCredential(event, credentialId) {
    const credential = await db
      .select()
      .from(schema.credentials)
      .where(eq(schema.credentials.id, credentialId))
      .then(r => r[0])

    if (!credential) throw createError({ statusCode: 400, message: 'Credential not found' })

    return {
      ...credential,
      publicKey: credential.publicKey, 
      backedUp: credential.backedUp === 1,
      transports: credential.transports ? JSON.parse(credential.transports) : [],
    }
  },
  async onSuccess(event, { credential, authenticationInfo }) {
    await db
      .update(schema.credentials)
      .set({ counter: authenticationInfo.newCounter })
      .where(eq(schema.credentials.id, credential.id))

    const userIdAsNumber = typeof credential.userId === 'string' 
      ? parseInt(credential.userId, 10) 
      : (credential.userId as number)

    const user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userIdAsNumber))
      .then(r => r[0])

    if (!user) throw createError({ statusCode: 400, message: 'User not found' })

    await setUserSession(event, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl ?? null,
      },
    })
  },
})