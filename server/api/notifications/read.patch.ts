import { db, schema } from '~~/server/utils/db'
import { eq, and, inArray } from 'drizzle-orm'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId: number = session.user.id

  const body = await readValidatedBody(
    event,
    z.object({
      ids: z.array(z.number()).optional(),
      all: z.boolean().optional(),
    }).parse,
  )

  if (!body.all && (!body.ids || body.ids.length === 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Provide ids or set all: true' })
  }

  const conditions = [
    eq(schema.notifications.userId, userId),
    eq(schema.notifications.isRead, false),
  ]

  if (body.all) {
    await db
      .update(schema.notifications)
      .set({ isRead: true })
      .where(and(...conditions))
  } else {
    await db
      .update(schema.notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(schema.notifications.userId, userId),
          inArray(schema.notifications.id, body.ids!),
        ),
      )
  }

  return { ok: true }
})
