import { db, schema } from '@nuxthub/db'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id
  const groupId = Number(getRouterParam(event, 'id'))
  if (!groupId || isNaN(groupId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid group ID' })
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
    throw createError({ statusCode: 403, statusMessage: 'Only admins can update groups' })
  }

  const body = await readValidatedBody(
    event,
    z.object({ name: z.string().trim().min(1).max(50) }).parse,
  )

  const [updated] = await db
    .update(schema.groups)
    .set({ name: body.name })
    .where(eq(schema.groups.id, groupId))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Group not found' })
  }

  return updated
})
