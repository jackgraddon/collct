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
  async validateUser(user, event) {
    const session = await getUserSession(event)
    const userBody = await z.object({
      userName: z.string().min(1).toLowerCase().trim(),
      displayName: z.string().min(1).trim().optional()
    }).parseAsync(user)

    if (session.user?.username) {
      // Existing session: must match username (normal re-registration or adding a device)
      if (session.user.username !== userBody.userName) {
        throw createError({ statusCode: 400, message: 'Username does not match session' })
      }
    } else if (session.recoveryUserId && session.recoveryScope === 'passkey_registration') {
       // Recovery flow: ensure username matches the recovery user's email/username
       const dbUser = await db.select().from(schema.users).where(eq(schema.users.id, session.recoveryUserId as number)).then(r => r[0])
       if (!dbUser || dbUser.username !== userBody.userName) {
         throw createError({ statusCode: 400, message: 'Username does not match recovery session' })
       }
    } else {
      const config = getAdminConfig()
      if (config.allowRegistration === 'no') {
        throw createError({
          statusCode: 403,
          statusMessage: 'Registration is disabled on this instance',
          message: 'Registration is disabled on this instance'
        })
      }
      if (config.allowRegistration === 'invite-only') {
        throw createError({
          statusCode: 403,
          statusMessage: 'This instance requires an invite code to register',
          message: 'This instance requires an invite code to register'
        })
      }

      // No session: check if user already exists (prevent account takeover)
      const existingUser = await db.select().from(schema.users).where(eq(schema.users.username, userBody.userName)).then(r => r[0])
      if (existingUser) {
        throw createError({ statusCode: 400, message: 'Username is already taken' })
      }
    }

    return userBody
  },
  async onSuccess(event, { user, credential }) {
    // Check for existing user by email (the actual user-provided identifier)
    const email = user.userName
    const existingUser = await db.select().from(schema.users).where(eq(schema.users.email, email)).then(r => r[0])
    
    let dbUser = existingUser
    let isNewUser = false
    if (!dbUser) {
      isNewUser = true
      // Derive username from email local part, ensure uniqueness
      const baseUsername = email.split('@')[0]
      let username = baseUsername
      let counter = 1
      while (true) {
         const taken = await db.select().from(schema.users).where(eq(schema.users.username, username as string)).then(r => r[0])
        if (!taken) break
        username = `${baseUsername}${counter}`
        counter++
      }

      const [newRow] = await db.insert(schema.users).values({
        username: username as string,
        name: user.displayName || baseUsername,
        email,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        totpEnabled: false
      } as any).returning()
      dbUser = newRow
    }

    if (!dbUser) {
      throw createError({ statusCode: 400, message: 'User creation failed' })
    }

    // Auto-join new users to the Public group
    const config = getAdminConfig()
    if (isNewUser && config.publicGroupEnabled) {
      await joinUserToPublic(dbUser.id)
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
        name: dbUser.name,
        email: dbUser.email,
        avatarUrl: dbUser.avatarUrl,
        totpEnabled: dbUser.totpEnabled,
        hasSeenOobe: dbUser.toursCompleted ? JSON.parse(dbUser.toursCompleted).includes('oobe-v1') : false,
      },
      loggedInAt: Date.now()
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