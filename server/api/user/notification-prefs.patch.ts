import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, schema } from '~~/server/utils/db'

const KEYS = ['like', 'comment', 'groupJoin', 'newPost', 'moment'] as const

// TypeScript property names (NOT DB column names) — drizzle's .set() matches
// keys against the table definition, and DB names silently produce an empty SET.
const TS_COLUMNS = {
  like: 'notifyLike',
  comment: 'notifyComment',
  groupJoin: 'notifyGroupJoin',
  newPost: 'notifyNewPost',
  moment: 'notifyMoment',
} as const

/**
 * Update per-type notification preferences. Partial update — send only the
 * keys to change. A disabled type suppresses both the push and the in-app
 * entry for new notifications of that type.
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id

  const body = await readValidatedBody(event, z.object({
    like: z.boolean().optional(),
    comment: z.boolean().optional(),
    groupJoin: z.boolean().optional(),
    newPost: z.boolean().optional(),
    moment: z.boolean().optional(),
  }).parse)

  const updates: {
    notifyLike?: boolean
    notifyComment?: boolean
    notifyGroupJoin?: boolean
    notifyNewPost?: boolean
    notifyMoment?: boolean
  } = {}
  for (const key of KEYS) {
    if (body[key] !== undefined) updates[TS_COLUMNS[key]] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  await db
    .update(schema.users)
    .set(updates)
    .where(eq(schema.users.id, userId))

  const [row] = await db
    .select({
      like: schema.users.notifyLike,
      comment: schema.users.notifyComment,
      groupJoin: schema.users.notifyGroupJoin,
      newPost: schema.users.notifyNewPost,
      moment: schema.users.notifyMoment,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)

  return { success: true, notificationPrefs: row }
})
