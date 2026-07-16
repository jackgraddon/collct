import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id))
    throw createError({ statusCode: 400, statusMessage: 'Invalid comment ID' })

  const [comment] = await db
    .select()
    .from(schema.comments)
    .where(eq(schema.comments.id, id))
    .limit(1)

  if (!comment)
    throw createError({ statusCode: 404, statusMessage: 'Comment not found' })
  if (comment.userId !== userId)
    throw createError({ statusCode: 403, statusMessage: 'You do not own this comment' })

  const body = await readValidatedBody(
    event,
    z.object({ body: z.string().trim().min(1).max(1000) }).parse,
  )

  const now = new Date()
  const history: { text: string; editedAt: string }[] = comment.editHistory
    ? JSON.parse(comment.editHistory)
    : []
  history.push({ text: body.body, editedAt: now.toISOString() })

  const [updated] = await db
    .update(schema.comments)
    .set({
      body: body.body,
      editHistory: JSON.stringify(history),
      editedAt: now,
    })
    .where(eq(schema.comments.id, id))
    .returning()

  return {
    ...updated,
    editHistory: history,
  }
})
