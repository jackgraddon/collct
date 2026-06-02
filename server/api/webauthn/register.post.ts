import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'

export default defineWebAuthnRegisterEventHandler({
  async storeChallenge(event, challenge, attemptId) {
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
        message: 'Challenge expired or invalid'
      })
    }
    
    deleteCookie(event, `webauthn_challenge_${attemptId}`)
    return challenge
  },
  validateUser: user => z.object({
    userName: z.string().min(1).toLowerCase().trim(),
    displayName: z.string().min(1).trim().optional()
  }).parseAsync(user),
  async onSuccess(event, { user, credential }) {
    // Look up existing user safely with Postgres syntax
    const existingUser = await db.select().from(schema.users).where(eq(schema.users.username, user.userName)).then(r => r[0])
    
    let dbUser = existingUser
    if (!dbUser) {
      // Avoid .get(), destruct row array instead
      const [newRow] = await db.insert(schema.users).values({
        username: user.userName,
        name: user.displayName || user.userName.split('@')[0],
        email: user.userName, // Assuming username maps to email
        createdAt: new Date(),
        lastLoginAt: new Date()
      }).returning()
      dbUser = newRow
    }

    if (!dbUser) {
      throw createError({ statusCode: 400, message: 'User creation failed' })
    }

    // Stringify transports array for text column compatibility
    await db.insert(schema.credentials).values({
      id: credential.id,
      userId: dbUser.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      backedUp: credential.backedUp,
      transports: JSON.stringify(credential.transports ?? [])
    })

    await setUserSession(event, {
      user: {
        id: dbUser.id,
        username: dbUser.username,
        name: dbUser.name || dbUser.username
      }
    })
  },
  async excludeCredentials(event, userName) {
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
  }
})