import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'

const ALLOWED_USERNAMES = ['test1', 'test2', 'test3'] as const

export default defineEventHandler(async (event) => {
  if (!process.dev) {
    throw createError({ statusCode: 403, statusMessage: 'Not available in production' })
  }

  const body = await readBody(event)
  const username = body?.username

  if (!username || !(ALLOWED_USERNAMES as readonly string[]).includes(username)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid username. Must be one of: ${ALLOWED_USERNAMES.join(', ')}`,
    })
  }

  const user = await db.query.users.findFirst({
    where: eq(schema.users.username, username),
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: `User "${username}" not found. Run the seed script first: pnpm db:seed:dev`,
    })
  }

  await setUserSession(event, {
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      totpEnabled: user.totpEnabled,
      hasSeenOobe: user.toursCompleted
        ? JSON.parse(user.toursCompleted).includes('oobe-v1')
        : false,
    },
    loggedInAt: Date.now(),
  })

  return { success: true, username }
})
