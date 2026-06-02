import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'

export default defineWebAuthnAuthenticateEventHandler({
  async allowCredentials(event: H3Event, userName: string) {
    if (!userName) return []

    // Find the user by e‑mail
    const user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, userName))
      .then((rows) => rows[0])

    if (!user) {
      throw createError({ statusCode: 400, message: 'User not found' })
    }

    // Pull all credential rows that belong to that user
    const userCredentials = await db
      .select()
      .from(schema.credentials)
      .where(eq(schema.credentials.userId, user.id))

    // The library only cares about the credential id (as a base64url string)
    return userCredentials.map((c) => ({
      id: c.id,
    }))
  },

  async getCredential(event: H3Event, credentialId: string) {
    const credential = await db
      .select()
      .from(schema.credentials)
      .where(eq(schema.credentials.id, credentialId))
      .then((rows) => rows[0])

    if (!credential) {
      throw createError({ statusCode: 400, message: 'Credential not found' })
    }

    // Helper: turn ordinary base64 → base64url (required by WebAuthn)
    const b64ToB64url = (b64: string) =>
      b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

    // `publicKey` may be stored as raw bytes (bytea) or as a base64 string.
    // Normalise it to a base64url string for the client.
    const publicKeyB64 = typeof credential.publicKey === 'string'
      ? credential.publicKey
      : Buffer.from(credential.publicKey as Uint8Array).toString('base64')
    const publicKeyB64url = b64ToB64url(publicKeyB64)

    return {
      ...credential,
      // The shape expected by nuxt‑auth‑utils:
      publicKey: publicKeyB64url,
      backedUp: credential.backedUp === 1,
      transports: credential.transports
        ? JSON.parse(credential.transports as string)
        : [],
    }
  },

  async onSuccess(
    event: H3Event,
    {
      credential,
      authenticationInfo,
    }: {
      credential: any
      authenticationInfo: { newCounter: number }
    }
  ) {
    // Update the stored counter (prevents replay attacks)
    await db
      .update(schema.credentials)
      .set({ counter: authenticationInfo.newCounter })
      .where(eq(schema.credentials.id, credential.id))

    // Retrieve the user linked to this credential
    const user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, Number(credential.userId))) // ← cast to number
      .then((rows) => rows[0])

    if (!user) {
      throw createError({ statusCode: 400, message: 'User not found' })
    }

    // Create the session (match the shape used elsewhere)
    await setUserSession(event, {
      user: {
        id: user.id,
        // Adjust the field names to whatever your schema actually defines
        // (e.g. `full_name` instead of `name` if that is the column name)
        name: (user as any).name ?? (user as any).full_name ?? '',
        email: user.email,
        avatarUrl: (user as any).avatarUrl ?? null,
      },
      loggedInAt: Date.now(),
    })
  },
})