import { db, schema } from '@nuxthub/db'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id
  const groupId = Number(getRouterParam(event, 'id'))
  if (!groupId || isNaN(groupId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid group ID' })
  }

  const [group] = await db
    .select()
    .from(schema.groups)
    .where(eq(schema.groups.id, groupId))
    .limit(1)

  if (!group) {
    throw createError({ statusCode: 404, statusMessage: 'Group not found' })
  }

  if (group.isPublic) {
    throw createError({ statusCode: 403, statusMessage: 'Cannot delete the Public group' })
  }

  if (group.ownerId !== userId) {
    throw createError({ statusCode: 403, statusMessage: 'Only the owner can delete a group' })
  }

  await db.delete(schema.groups).where(eq(schema.groups.id, groupId))

  return { ok: true }
})
