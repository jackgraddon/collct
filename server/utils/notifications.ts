import { db, schema } from '@nuxthub/db'
import { eq, and, sql } from 'drizzle-orm'
import { getAdminConfig } from './config'

interface CreateNotificationData {
  userId: number
  actorId: number
  type: 'like' | 'comment' | 'group_join' | 'new_post' | 'moment'
  photoId?: number
  commentId?: number
  groupIds?: number[]
}

function generateNotificationTag(type: string, data: CreateNotificationData): string | null {
  switch (type) {
    case 'like':
      return data.photoId ? `like_${data.photoId}` : null
    case 'comment':
      return data.photoId && data.commentId ? `comment_${data.photoId}_${data.commentId}` : null
    case 'moment':
      return `moment_${data.userId}_${new Date().toISOString().slice(0, 10)}`
    case 'group_join':
      return data.groupIds?.length ? `group_join_${data.groupIds[0]}_${data.userId}` : null
    case 'new_post':
      return data.photoId ? `new_post_${data.photoId}_${data.userId}` : null
    default:
      return null
  }
}

/**
 * Create or update a notification, skipping self-notifications.
 * For like notifications, consolidates multiple likes on the same photo
 * into a single notification with an updated count.
 * Sends a push notification (fire-and-forget, debounced for likes).
 */
export async function createNotification(data: CreateNotificationData) {
  if (data.userId === data.actorId) return

  if (data.type === 'like' && data.photoId) {
    await createOrUpdateLikeNotification(data)
    return
  }

  const tag = generateNotificationTag(data.type, data)

  if (tag) {
    const [existing] = await db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, data.userId),
          eq(schema.notifications.notificationTag, tag),
          eq(schema.notifications.isRead, false),
        ),
      )
      .limit(1)

    if (existing) {
      await db
        .update(schema.notifications)
        .set({ actorId: data.actorId })
        .where(eq(schema.notifications.id, existing.id))

      sendPushForNotification({ ...data, notificationId: existing.id }).catch(() => {})
      return
    }
  }

  const [notification] = await db
    .insert(schema.notifications)
    .values({
      userId: data.userId,
      actorId: data.actorId,
      type: data.type,
      photoId: data.photoId ?? null,
      commentId: data.commentId ?? null,
      groupId: data.groupIds?.length ? JSON.stringify(data.groupIds) : null,
      notificationTag: tag,
    })
    .returning({ id: schema.notifications.id })

  sendPushForNotification({ ...data, notificationId: notification?.id }).catch(() => {})
}

/**
 * Like notification consolidation:
 * - If an active notification exists for this photo, update it (new actor, count++)
 * - Otherwise, create a new one
 * - Debounce push sends by 1s to coalesce rapid likes
 */
async function createOrUpdateLikeNotification(data: CreateNotificationData) {
  const tag = `like_${data.photoId}`

  const [existing] = await db
    .select({ id: schema.notifications.id })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, data.userId),
        eq(schema.notifications.notificationTag, tag),
        eq(schema.notifications.isRead, false),
      ),
    )
    .limit(1)

  let notificationId: number

  if (existing) {
    await db
      .update(schema.notifications)
      .set({ actorId: data.actorId })
      .where(eq(schema.notifications.id, existing.id))
    notificationId = existing.id
  } else {
    const [inserted] = await db
      .insert(schema.notifications)
      .values({
        userId: data.userId,
        actorId: data.actorId,
        type: 'like',
        photoId: data.photoId,
        notificationTag: tag,
      })
      .returning({ id: schema.notifications.id })
    notificationId = inserted!.id
  }

  scheduleDebouncedLikePush(data.userId, data.photoId!, notificationId)
}

const DEBOUNCE_MS = 1000
const pendingLikePushes = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleDebouncedLikePush(userId: number, photoId: number, notificationId: number) {
  const key = `like_${photoId}_${userId}`

  const existing = pendingLikePushes.get(key)
  if (existing) clearTimeout(existing)

  pendingLikePushes.set(
    key,
    setTimeout(async () => {
      pendingLikePushes.delete(key)

      const [countResult] = await db
        .select({ total: sql<number>`count(distinct ${schema.likes.userId})` })
        .from(schema.likes)
        .where(eq(schema.likes.photoId, photoId))

      const likeCount = countResult ? Number(countResult.total) : 0

      await sendPushForNotification({
        userId,
        actorId: 0,
        type: 'like',
        photoId,
        notificationId,
        likeCount,
      })
    }, DEBOUNCE_MS),
  )
}

interface PushData extends CreateNotificationData {
  notificationId?: number
  likeCount?: number
}

async function sendPushForNotification(data: PushData) {
  const [actor] = await db
    .select({ name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.id, data.actorId))
    .limit(1)

  const actorName = actor?.name ?? 'Someone'

  let body = ''
  let tag = ''
  let navigate = '/'
  const pushData: Record<string, string | number> = { type: data.type }
  if (data.notificationId) pushData.notificationId = data.notificationId

  switch (data.type) {
    case 'like': {
      const count = data.likeCount ?? 0
      if (count <= 1) {
        body = `${actorName} liked your photo`
      } else {
        body = `${count} people liked your photo`
      }
      tag = `like_${data.photoId}`
      if (data.photoId) {
        pushData.photoId = data.photoId
        navigate = `/post/${data.photoId}`
      }
      break
    }
    case 'comment':
      body = `${actorName} commented on your photo`
      tag = `comment_${data.photoId}_${data.commentId}`
      if (data.photoId) {
        pushData.photoId = data.photoId
        navigate = `/post/${data.photoId}`
      }
      break
    case 'group_join':
      body = `${actorName} joined your group`
      tag = `group_join_${data.groupIds?.[0] ?? ''}_${data.userId}`
      if (data.groupIds?.length) {
        pushData.groupId = data.groupIds[0]
        navigate = `/groups/${data.groupIds[0]}`
      }
      break
    case 'new_post':
      body = `${actorName} posted a new photo`
      tag = `new_post_${data.photoId}_${data.userId}`
      if (data.photoId) {
        pushData.photoId = data.photoId
        navigate = `/post/${data.photoId}`
      }
      break
    case 'moment':
      body = 'Time for your daily moment! Capture a photo now.'
      tag = `moment_${data.userId}_${new Date().toISOString().slice(0, 10)}`
      navigate = '/?moment=capture'
      break
  }

  await sendPushNotification(data.userId, {
    title: getAdminConfig().instanceName || 'Collct',
    body,
    icon: '/icon-192x192.png',
    tag,
    navigate,
    data: pushData,
  })
}

/**
 * Handle unlike: update the consolidated like notification or delete it
 * if no likes remain. Resends push with updated count.
 */
export async function deleteNotification(where: {
  userId: number
  actorId: number
  type: string
  photoId?: number
}) {
  if (where.type === 'like' && where.photoId !== undefined) {
    await deleteOrUpdateLikeNotification(where.userId, where.photoId)
    return
  }

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

async function deleteOrUpdateLikeNotification(userId: number, photoId: number) {
  const tag = `like_${photoId}`

  const [countResult] = await db
    .select({ total: sql<number>`count(distinct ${schema.likes.userId})` })
    .from(schema.likes)
    .where(eq(schema.likes.photoId, photoId))

  const likeCount = countResult ? Number(countResult.total) : 0

  const [existing] = await db
    .select({ id: schema.notifications.id })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, userId),
        eq(schema.notifications.notificationTag, tag),
        eq(schema.notifications.isRead, false),
      ),
    )
    .limit(1)

  if (!existing) return

  if (likeCount === 0) {
    await db.delete(schema.notifications).where(eq(schema.notifications.id, existing.id))
  } else {
    await sendPushForNotification({
      userId,
      actorId: 0,
      type: 'like',
      photoId,
      notificationId: existing.id,
      likeCount,
    })
  }
}

/**
 * Dismiss a notification: soft-delete by setting dismissedAt.
 * Called by the client when the user clears a notification from the in-app view.
 * OS-level dismiss (notificationclose) does NOT call this.
 */
export async function dismissNotification(notificationId: number, userId: number) {
  await db
    .update(schema.notifications)
    .set({ dismissedAt: new Date() })
    .where(
      and(
        eq(schema.notifications.id, notificationId),
        eq(schema.notifications.userId, userId),
      ),
    )
}

/**
 * Clean up old dismissed notifications past the retention period.
 * Called from the moment trigger cron. Retention configurable via
 * COLLCT_NOTIFICATION_RETENTION_DAYS (default: 30).
 */
export async function cleanupDismissedNotifications(): Promise<number> {
  const retentionDays = Number(process.env.COLLCT_NOTIFICATION_RETENTION_DAYS) || 30

  const result = await db
    .delete(schema.notifications)
    .where(
      and(
        sql`${schema.notifications.dismissedAt} IS NOT NULL`,
        sql`${schema.notifications.dismissedAt} < now() - interval '${retentionDays} days'`,
      ),
    )

  return result.rowCount ?? 0
}
