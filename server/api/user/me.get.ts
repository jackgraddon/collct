import { eq } from 'drizzle-orm'
import { db, schema } from '~~/server/utils/db'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  const user = session.user

  let avatarUrl = user.avatarUrl ?? null
  if (avatarUrl) {
    avatarUrl = await getBlobUrl(avatarUrl)
  }

  const dbUser = await db.query.users.findFirst({
    where: eq(schema.users.id, user.id),
    columns: { toursCompleted: true },
  })

  const toursCompleted: string[] = dbUser?.toursCompleted
    ? JSON.parse(dbUser.toursCompleted)
    : []

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatarUrl,
    hasSeenOobe: toursCompleted.includes('oobe-v1'),
  }
})