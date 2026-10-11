import { db, schema } from '~~/server/utils/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id))
    throw createError({ statusCode: 400, statusMessage: 'Invalid photo ID' })

  const [photo] = await db
    .select()
    .from(schema.photos)
    .where(eq(schema.photos.id, id))
    .limit(1)

  if (!photo)
    throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  if (photo.userId !== userId)
    throw createError({ statusCode: 403, statusMessage: 'You do not own this photo' })

  const body = await readValidatedBody(
    event,
    z.object({ caption: z.string().max(500).nullable() }).parse,
  )

  const now = new Date()
  const history: { text: string | null; editedAt: string }[] = photo.captionHistory
    ? JSON.parse(photo.captionHistory)
    : []
  history.push({ text: body.caption, editedAt: now.toISOString() })

  const [updated] = await db
    .update(schema.photos)
    .set({
      caption: body.caption,
      captionHistory: JSON.stringify(history),
      captionEditedAt: now,
    })
    .where(eq(schema.photos.id, id))
    .returning()

  return {
    ...updated,
    captionHistory: history,
  }
})
