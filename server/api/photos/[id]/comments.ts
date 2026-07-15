import { eq, asc, inArray, sql, and } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'
import { z } from 'zod'

type ReactionType = 'thumbs_up' | 'thumbs_down' | 'heart' | 'cry'

interface ReactionRow {
  commentId: number
  type: ReactionType
  userId: number
}

interface ReactionCounts {
  thumbs_up: number
  thumbs_down: number
  heart: number
  cry: number
}

export default defineEventHandler(async (event) => {
  const photoId = Number(getRouterParam(event, 'id'))
  if (isNaN(photoId)) throw createError({ statusCode: 400, message: 'Invalid photo ID' })

  if (event.method === 'GET') {
    const session = await getUserSession(event)
    const currentUserId: number | null = session?.user?.id ?? null

    if (currentUserId === null) return []

    // Fetch comments where the commenter and viewer share a group on this photo
    const rows = await db
      .select({
        id: schema.comments.id,
        body: schema.comments.body,
        createdAt: schema.comments.createdAt,
        userId: schema.comments.userId,
        userName: schema.users.name,
        userAvatarUrl: schema.users.avatarUrl,
        username: schema.users.username,
      })
      .from(schema.comments)
      .innerJoin(schema.users, eq(schema.comments.userId, schema.users.id))
      .innerJoin(
        schema.photoGroups,
        eq(schema.photoGroups.photoId, schema.comments.photoId),
      )
      .innerJoin(
        schema.groupMembers,
        and(
          eq(schema.groupMembers.groupId, schema.photoGroups.groupId),
          eq(schema.groupMembers.userId, currentUserId),
        ),
      )
      .where(
        and(
          eq(schema.comments.photoId, photoId),
          sql`EXISTS (
            SELECT 1
            FROM ${schema.photoGroups} pg2
            JOIN ${schema.groupMembers} gm_author
              ON gm_author.group_id = pg2.group_id AND gm_author.user_id = ${schema.comments.userId}
            WHERE pg2.photo_id = ${photoId}
          )`,
        ),
      )
      .orderBy(asc(schema.comments.createdAt))

    if (!rows.length) return []

    // Fetch all reactions for these comments in one query
    const commentIds = rows.map((r) => r.id)
    const reactionRows = await db
      .select({
        commentId: schema.commentReactions.commentId,
        type: schema.commentReactions.type,
        userId: schema.commentReactions.userId,
      })
      .from(schema.commentReactions)
      .where(inArray(schema.commentReactions.commentId, commentIds))

    // Group reactions by commentId
    const REACTION_TYPES: ReactionType[] = ['thumbs_up', 'thumbs_down', 'heart', 'cry']

    const reactionsByComment = Object.fromEntries(
      commentIds.map((cid) => {
        const cReactions = reactionRows.filter((r) => r.commentId === cid)
        const counts = Object.fromEntries(
          REACTION_TYPES.map((type) => [
            type,
            cReactions.filter((r) => r.type === type).length,
          ]),
        ) as unknown as ReactionCounts
        const myReaction = currentUserId
          ? (cReactions.find((r) => r.userId === currentUserId)?.type ?? null)
          : null
        return [cid, { counts, myReaction }]
      }),
    )

    return rows.map((r) => ({
      id: r.id,
      body: r.body,
      createdAt: r.createdAt,
      user: {
        id: r.userId,
        name: r.userName,
        username: r.username,
        avatarUrl: r.userAvatarUrl,
      },
      reactions: reactionsByComment[r.id],
    }))
  }

  if (event.method === 'POST') {
    const session = await requireUserSession(event)
    const currentUserId: number = session.user.id

    // Check viewer can see this photo's groups
    const [viewerMembership] = await db
      .select({ id: schema.groupMembers.id })
      .from(schema.groupMembers)
      .innerJoin(
        schema.photoGroups,
        and(
          eq(schema.photoGroups.groupId, schema.groupMembers.groupId),
          eq(schema.photoGroups.photoId, photoId),
        ),
      )
      .where(eq(schema.groupMembers.userId, currentUserId))
      .limit(1)

    if (!viewerMembership) {
      throw createError({ statusCode: 404, message: 'Photo not found' })
    }

    const body = await readValidatedBody(
      event,
      z.object({ body: z.string().trim().min(1).max(1000) }).parse,
    )

    const [comment] = await db
      .insert(schema.comments)
      .values({ photoId, userId: currentUserId, body: body.body })
      .returning()

    if (!comment) throw createError({ statusCode: 500, message: 'Failed to create comment' })

    // Return in the same shape as GET rows so the client can push it into the list
    const [author] = await db
      .select({ name: schema.users.name, username: schema.users.username, avatarUrl: schema.users.avatarUrl })
      .from(schema.users)
      .where(eq(schema.users.id, currentUserId))
      .limit(1)

    return {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      user: { id: currentUserId, ...author },
      reactions: {
        counts: { thumbs_up: 0, thumbs_down: 0, heart: 0, cry: 0 } as ReactionCounts,
        myReaction: null,
      },
    }
  }

  throw createError({ statusCode: 405 })
})
