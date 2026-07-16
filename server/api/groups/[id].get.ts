import { db, schema } from '@nuxthub/db'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id
  const groupId = Number(getRouterParam(event, 'id'))
  if (!groupId || isNaN(groupId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid group ID' })
  }

  // Verify membership
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
    throw createError({ statusCode: 404, statusMessage: 'Group not found' })
  }

  const [group] = await db
    .select()
    .from(schema.groups)
    .where(eq(schema.groups.id, groupId))
    .limit(1)

  if (!group) {
    throw createError({ statusCode: 404, statusMessage: 'Group not found' })
  }

  const members = await db
    .select({
      id: schema.groupMembers.id,
      userId: schema.groupMembers.userId,
      role: schema.groupMembers.role,
      joinedAt: schema.groupMembers.joinedAt,
      username: schema.users.username,
      name: schema.users.name,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.groupMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.groupMembers.userId))
    .where(eq(schema.groupMembers.groupId, groupId))

  const resolvedMembers = await Promise.all(
    members.map(async (m) => {
      let avatarUrl = m.avatarUrl
      if (avatarUrl) {
        avatarUrl = await getBlobUrl(avatarUrl)
      }
      return { ...m, avatarUrl }
    }),
  )

  return { ...group, members: resolvedMembers }
})
