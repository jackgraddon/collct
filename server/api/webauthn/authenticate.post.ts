import { eq } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'

export default defineWebAuthnAuthenticateEventHandler({
  async storeChallenge(event, challenge, attemptId) {
    rateLimit(`webauthn:auth:${getClientIp(event)}`, RATE_LIMITS.webauthn)

    setCookie(event, `webauthn_challenge_${attemptId}`, challenge, {
      maxAge: 60,
      httpOnly: true, // Prevents XSS access
      secure: true,   // Required for WebAuthn in production
      sameSite: 'lax'
    })
  },
  async getChallenge(event, attemptId) {
    const challenge = getCookie(event, `webauthn_challenge_${attemptId}`)
    
    if (!challenge) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Challenge expired or invalid'
      })
    }
    
    deleteCookie(event, `webauthn_challenge_${attemptId}`)
    return challenge
  },
  async allowCredentials(event, userName) {
    const rows = await db
      .select({
        id: schema.credentials.id,
        transports: schema.credentials.transports
      })
      .from(schema.credentials)
      .innerJoin(schema.users, eq(schema.users.id, schema.credentials.userId))
      .where(eq(schema.users.username, userName))

    return rows.map(row => ({
      id: row.id,
      transports: typeof row.transports === 'string' ? JSON.parse(row.transports) : (row.transports ?? [])
    }))
  },
  async getCredential(event, credentialID) {
    const cred = await db.select().from(schema.credentials).where(eq(schema.credentials.id, credentialID)).then(r => r[0])
    
    if (!cred) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Credential not found'
      })
    }

    // Returns standard WebAuthnCredential shape explicitly
    return {
      id: cred.id,
      publicKey: cred.publicKey,
      counter: cred.counter,
      backedUp: cred.backedUp,
      transports: typeof cred.transports === 'string' ? JSON.parse(cred.transports) : (cred.transports ?? [])
    }
  },
  async onSuccess(event, { credential, authenticationInfo }) {
    // 1. Update authentication counter
    await db.update(schema.credentials)
      .set({ counter: authenticationInfo.newCounter })
      .where(eq(schema.credentials.id, credential.id))

    // 2. Fetch corresponding user details cleanly via a Join 
    // This avoids type errors regarding credential property extensions
    const row = await db
      .select({ user: schema.users })
      .from(schema.credentials)
      .innerJoin(schema.users, eq(schema.users.id, schema.credentials.userId))
      .where(eq(schema.credentials.id, credential.id))
      .then(r => r[0])

    if (!row) {
      throw createError({ statusCode: 400, statusMessage: 'User associated with credential not found' })
    }

    if (row.user.totpEnabled) {
      // Create a temporary session without user object to enforce MFA
      await setUserSession(event, {
        unverifiedUserId: row.user.id,
        loggedInAt: Date.now(),
      })
      return { mfaRequired: true } as any
    }

    await setUserSession(event, {
      user: {
        id: row.user.id,
        username: row.user.username,
        name: row.user.name,
        email: row.user.email,
        avatarUrl: row.user.avatarUrl,
        totpEnabled: false,
        hasSeenOobe: row.user.toursCompleted ? JSON.parse(row.user.toursCompleted).includes('oobe-v1') : false,
      },
      loggedInAt: Date.now()
    })
  }
})
