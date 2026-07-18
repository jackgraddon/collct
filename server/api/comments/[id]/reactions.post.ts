import { eq, and } from 'drizzle-orm'
import { schema } from '@nuxthub/db'
import { z } from 'zod'

type ReactionType = 'thumbs_up' | 'thumbs_down' | 'heart' | 'cry'

interface ReactionCounts {
  thumbs_up: number
  thumbs_down: number
  heart: number
  cry: number
}

const REACTION_TYPES: ReactionType[] = ['thumbs_up', 'thumbs_down', 'heart', 'cry']

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const currentUserId: number = session.user.id

  const commentId = Number(getRouterParam(event, 'id'))
  if (isNaN(commentId)) throw createError({ statusCode: 400, message: 'Invalid comment ID' })

  const { type } = await readValidatedBody(
    event,
    z.object({ type: z.enum(['thumbs_up', 'thumbs_down', 'heart', 'cry']) }).parse,
  )

  // Verify comment exists and get its photoId
  const [comment] = await db
    .select({ id: schema.comments.id, photoId: schema.comments.photoId })
    .from(schema.comments)
    .where(eq(schema.comments.id, commentId))
    .limit(1)
  if (!comment) throw createError({ statusCode: 404, message: 'Comment not found' })

  // Check viewer can see this comment's photo's groups
  const [viewerMembership] = await db
    .select({ id: schema.groupMembers.id })
    .from(schema.groupMembers)
    .innerJoin(
      schema.photoGroups,
      and(
        eq(schema.photoGroups.groupId, schema.groupMembers.groupId),
        eq(schema.photoGroups.photoId, comment.photoId),
      ),
    )
    .where(eq(schema.groupMembers.userId, currentUserId))
    .limit(1)

  if (!viewerMembership) {
    throw createError({ statusCode: 404, message: 'Comment not found' })
  }

  // Check for existing reaction from this user
  const [existing] = await db
    .select({ id: schema.commentReactions.id, type: schema.commentReactions.type })
    .from(schema.commentReactions)
    .where(
      and(
        eq(schema.commentReactions.commentId, commentId),
        eq(schema.commentReactions.userId, currentUserId),
      ),
    )
    .limit(1)

  if (existing) {
    if (existing.type === type) {
      // Same type → toggle off (remove)
      await db.delete(schema.commentReactions).where(eq(schema.commentReactions.id, existing.id))
    } else {
      // Different type → replace
      await db
        .update(schema.commentReactions)
        .set({ type })
        .where(eq(schema.commentReactions.id, existing.id))
    }
  } else {
    // No existing reaction → insert
    await db.insert(schema.commentReactions).values({ commentId, userId: currentUserId, type })
  }

  // Return fresh counts + caller's current reaction for this comment
  const allReactions = await db
    .select({ type: schema.commentReactions.type, userId: schema.commentReactions.userId })
    .from(schema.commentReactions)
    .where(eq(schema.commentReactions.commentId, commentId))

  const counts = Object.fromEntries(
    REACTION_TYPES.map((t) => [
      t,
      allReactions.filter((r: { type: ReactionType; userId: number }) => r.type === t).length,
    ]),
  ) as ReactionCounts

  const myReaction = allReactions.find((r: { type: ReactionType; userId: number }) => r.userId === currentUserId)?.type ?? null

  return { counts, myReaction }
})
