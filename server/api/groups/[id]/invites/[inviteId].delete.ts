import { db, schema } from '~~/server/utils/db'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id
  const groupId = Number(getRouterParam(event, 'id'))
  if (!groupId || isNaN(groupId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid group ID' })
  }

  const inviteId = getRouterParam(event, 'inviteId')
  if (!inviteId) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid invite ID' })
  }

  // Verify admin+ membership
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

  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    throw createError({ statusCode: 403, statusMessage: 'Only admins can revoke invites' })
  }

  const [updated] = await db
    .update(schema.groupInvites)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.groupInvites.id, inviteId),
        eq(schema.groupInvites.groupId, groupId),
      ),
    )
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Invite not found' })
  }

  return { ok: true }
})
