import { db, schema } from '@nuxthub/db'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id

  const body = await readValidatedBody(
    event,
    z.object({ code: z.string().trim().min(1) }).parse,
  )

  const [invite] = await db
    .select()
    .from(schema.groupInvites)
    .where(eq(schema.groupInvites.code, body.code))
    .limit(1)

  if (!invite) {
    throw createError({ statusCode: 404, statusMessage: 'Invalid invite code' })
  }

  if (invite.revokedAt) {
    throw createError({ statusCode: 410, statusMessage: 'This invite has been revoked' })
  }

  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw createError({ statusCode: 410, statusMessage: 'This invite has expired' })
  }

  if (invite.maxUses && invite.useCount >= invite.maxUses) {
    throw createError({ statusCode: 410, statusMessage: 'This invite has reached its maximum uses' })
  }

  // Check if already a member
  const [existing] = await db
    .select()
    .from(schema.groupMembers)
    .where(
      and(
        eq(schema.groupMembers.groupId, invite.groupId),
        eq(schema.groupMembers.userId, userId),
      ),
    )
    .limit(1)

  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'You are already a member of this group' })
  }

  // Redeem: add membership + increment use count
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.groupMembers)
      .values({ groupId: invite.groupId, userId, role: 'member' })

    await tx
      .update(schema.groupInvites)
      .set({ useCount: invite.useCount + 1 })
      .where(eq(schema.groupInvites.id, invite.id))
  })

  // Ensure user is also in Public
  await joinUserToPublic(userId)

  // Notify group owner
  const [group] = await db
    .select({ ownerId: schema.groups.ownerId })
    .from(schema.groups)
    .where(eq(schema.groups.id, invite.groupId))
    .limit(1)
  if (group?.ownerId) {
    await createNotification({
      userId: group.ownerId,
      actorId: userId,
      type: 'group_join',
      groupIds: [invite.groupId],
    })
  }

  return { ok: true, groupId: invite.groupId }
})
