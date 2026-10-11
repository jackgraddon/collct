import { db, schema } from '~~/server/utils/db'
import { eq, and, isNull } from 'drizzle-orm'
import { z } from 'zod'

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let code = ''
  for (let i = 0; i < 10; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

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
    throw createError({ statusCode: 403, statusMessage: 'Only admins can create invites' })
  }

  if (event.method === 'GET') {
    const invites = await db
      .select()
      .from(schema.groupInvites)
      .where(
        and(
          eq(schema.groupInvites.groupId, groupId),
          isNull(schema.groupInvites.revokedAt),
        ),
      )

    return { invites }
  }

  if (event.method === 'POST') {
    const body = await readValidatedBody(
      event,
      z.object({
        maxUses: z.number().int().positive().nullable().optional(),
        expiresInHours: z.number().int().positive().max(720).nullable().optional(),
      }).parse,
    )

    const code = generateInviteCode()
    const expiresAt = body.expiresInHours
      ? new Date(Date.now() + body.expiresInHours * 60 * 60 * 1000)
      : null

    const [invite] = await db
      .insert(schema.groupInvites)
      .values({
        groupId,
        code,
        createdBy: userId,
        maxUses: body.maxUses ?? null,
        expiresAt,
      })
      .returning()

    return invite
  }

  throw createError({ statusCode: 405 })
})
