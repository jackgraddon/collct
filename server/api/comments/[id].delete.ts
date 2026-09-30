import { db, schema } from '~~/server/utils/db'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id))
    throw createError({ statusCode: 400, statusMessage: 'Invalid comment ID' })

  const [comment] = await db
    .select({ id: schema.comments.id, userId: schema.comments.userId })
    .from(schema.comments)
    .where(eq(schema.comments.id, id))
    .limit(1)

  if (!comment)
    throw createError({ statusCode: 404, statusMessage: 'Comment not found' })
  if (comment.userId !== userId)
    throw createError({ statusCode: 403, statusMessage: 'You do not own this comment' })

  // Reactions cascade via onDelete — notifications referencing the comment
  // keep their photo link (photoId), so no further cleanup is needed.
  await db.delete(schema.comments).where(eq(schema.comments.id, id))

  return { ok: true }
})
