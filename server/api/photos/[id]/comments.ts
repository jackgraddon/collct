import { eq, asc, inArray } from 'drizzle-orm'
import { schema } from '@nuxthub/db'
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

    // Fetch comments with author info
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
      .where(eq(schema.comments.photoId, photoId))
      .orderBy(asc(schema.comments.createdAt))

    if (!rows.length) return []

    // Fetch all reactions for these comments in one query
    const commentIds = rows.map((r: typeof rows[number]) => r.id)
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
      commentIds.map((cid: number) => {
        const cReactions = reactionRows.filter((r: ReactionRow) => r.commentId === cid)
        const counts = Object.fromEntries(
          REACTION_TYPES.map((type: ReactionType) => [
            type,
            cReactions.filter((r: ReactionRow) => r.type === type).length,
          ]),
        ) as ReactionCounts
        const myReaction = currentUserId
          ? (cReactions.find((r: ReactionRow) => r.userId === currentUserId)?.type ?? null)
          : null
        return [cid, { counts, myReaction }]
      }),
    )

    return rows.map((r: typeof rows[number]) => ({
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

    const body = await readValidatedBody(
      event,
      z.object({ body: z.string().trim().min(1).max(1000) }).parse,
    )

    const [comment] = await db
      .insert(schema.comments)
      .values({ photoId, userId: currentUserId, body: body.body })
      .returning()

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