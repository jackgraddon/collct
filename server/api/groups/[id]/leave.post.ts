import { db, schema } from '~~/server/utils/db'
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
    throw createError({ statusCode: 403, statusMessage: 'Cannot leave the Public group' })
  }

  const [membership] = await db
    .select()
    .from(schema.groupMembers)
    .where(
      and(
        eq(schema.groupMembers.groupId, groupId),
        eq(schema.groupMembers.userId, userId),
      ),
    )
    .limit(1)

  if (!membership) {
    throw createError({ statusCode: 404, statusMessage: 'You are not a member of this group' })
  }

  if (membership.role === 'owner') {
    throw createError({
      statusCode: 403,
      statusMessage: 'The owner cannot leave their own group. Transfer ownership or delete it.',
    })
  }

  await db
    .delete(schema.groupMembers)
    .where(eq(schema.groupMembers.id, membership.id))

  return { ok: true }
})
