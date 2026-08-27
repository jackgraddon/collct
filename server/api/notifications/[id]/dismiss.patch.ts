import { db, schema } from '@nuxthub/db'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId: number = session.user.id

  const id = Number(getRouterParam(event, 'id'))
  if (isNaN(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid notification ID' })

  await db
    .update(schema.notifications)
    .set({ dismissedAt: new Date() })
    .where(
      and(
        eq(schema.notifications.id, id),
        eq(schema.notifications.userId, userId),
      ),
    )

  return { ok: true }
})
