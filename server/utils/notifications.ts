import { db, schema } from '@nuxthub/db'
import { eq, and } from 'drizzle-orm'

interface CreateNotificationData {
  userId: number
  actorId: number
  type: 'like' | 'comment' | 'group_join'
  photoId?: number
  commentId?: number
  groupId?: number
}

/**
 * Create a notification, skipping self-notifications.
 */
export async function createNotification(data: CreateNotificationData) {
  if (data.userId === data.actorId) return

  await db.insert(schema.notifications).values({
    userId: data.userId,
    actorId: data.actorId,
    type: data.type,
    photoId: data.photoId ?? null,
    commentId: data.commentId ?? null,
    groupId: data.groupId ?? null,
  })
}

/**
 * Delete a notification matching the given criteria.
 * Used when toggling off a like.
 */
export async function deleteNotification(where: {
  userId: number
  actorId: number
  type: string
  photoId?: number
}) {
  const conditions = [
    eq(schema.notifications.userId, where.userId),
    eq(schema.notifications.actorId, where.actorId),
    eq(schema.notifications.type, where.type as any),
  ]
  if (where.photoId !== undefined) {
    conditions.push(eq(schema.notifications.photoId, where.photoId))
  }
  await db.delete(schema.notifications).where(and(...conditions))
}
