import { db, schema } from '@nuxthub/db'
import { eq, and } from 'drizzle-orm'
import { getAdminConfig } from './config'

interface CreateNotificationData {
  userId: number
  actorId: number
  type: 'like' | 'comment' | 'group_join' | 'new_post' | 'moment'
  photoId?: number
  commentId?: number
  groupIds?: number[]
}

/**
 * Create a notification, skipping self-notifications.
 * Also sends a push notification (fire-and-forget).
 */
export async function createNotification(data: CreateNotificationData) {
  if (data.userId === data.actorId) return

  await db.insert(schema.notifications).values({
    userId: data.userId,
    actorId: data.actorId,
    type: data.type,
    photoId: data.photoId ?? null,
    commentId: data.commentId ?? null,
    groupId: data.groupIds?.length ? JSON.stringify(data.groupIds) : null,
  })

  // Fire-and-forget push notification
  sendPushForNotification(data).catch(() => {})
}

async function sendPushForNotification(data: CreateNotificationData) {
  const [actor] = await db
    .select({ name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.id, data.actorId))
    .limit(1)

  const actorName = actor?.name ?? 'Someone'

  let body = ''
  let tag = ''
  const pushData: Record<string, string> = { type: data.type }

  switch (data.type) {
    case 'like':
      body = `${actorName} liked your photo`
      tag = `like-${data.photoId}`
      if (data.photoId) pushData.photoId = String(data.photoId)
      break
    case 'comment':
      body = `${actorName} commented on your photo`
      tag = `comment-${data.photoId}`
      if (data.photoId) pushData.photoId = String(data.photoId)
      break
    case 'group_join':
      body = `${actorName} joined your group`
      tag = `group_join-${data.groupIds?.[0] ?? ''}`
      if (data.groupIds?.length) pushData.groupId = String(data.groupIds[0])
      break
    case 'new_post':
      body = `${actorName} posted a new photo`
      tag = `new_post-${data.photoId}`
      if (data.photoId) pushData.photoId = String(data.photoId)
      break
    case 'moment':
      body = 'Time for your daily moment! Capture a photo now.'
      tag = `moment-${new Date().toISOString().slice(0, 10)}`
      break
  }

  await sendPushNotification(data.userId, {
    title: getAdminConfig().instanceName || 'Collct',
    body,
    icon: '/icon-192x192.png',
    tag,
    data: pushData,
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
