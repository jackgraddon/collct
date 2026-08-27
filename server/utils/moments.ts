import { db, schema } from '@nuxthub/db'
import { eq, and, gte, lt, sql } from 'drizzle-orm'

/**
 * Get today's date string in YYYY-MM-DD format (server timezone).
 */
function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Generate a deterministic notification tag for a user's moment notification today.
 */
function generateMomentTag(userId: number): string {
  return `moment_${userId}_${getTodayKey()}`
}

/**
 * Compute a random moment time within the configured window for today.
 * Returns an ISO timestamp.
 */
function computeMomentTime(windowStart: string, windowEnd: string): Date {
  const [startH, startM] = windowStart.split(':').map(Number)
  const [endH, endM] = windowEnd.split(':').map(Number)

  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  const randomMinutes = startMinutes + Math.random() * (endMinutes - startMinutes)
  const hours = Math.floor(randomMinutes / 60)
  const minutes = Math.floor(randomMinutes % 60)

  const now = new Date()
  const result = new Date(now)
  result.setHours(hours, minutes, 0, 0)
  return result
}

/**
 * Get or compute today's moment time.
 * Stores in config table for consistency across all clients.
 */
export async function getOrCreateTodayMomentTime(): Promise<{ momentTime: Date; windowStart: string; windowEnd: string }> {
  const config = getAdminConfig()
  const today = getTodayKey()
  const key = `moment_time_${today}`

  // Check if already stored
  const [existing] = await db
    .select({ value: schema.config.value })
    .from(schema.config)
    .where(eq(schema.config.key, key))
    .limit(1)

  if (existing) {
    return {
      momentTime: new Date(existing.value),
      windowStart: config.momentsWindowStart,
      windowEnd: config.momentsWindowEnd,
    }
  }

  // Compute and store
  const momentTime = computeMomentTime(config.momentsWindowStart, config.momentsWindowEnd)

  await db.insert(schema.config).values({
    key,
    value: momentTime.toISOString(),
  }).onConflictDoNothing()

  // Re-read in case of race condition (another request inserted first)
  const [stored] = await db
    .select({ value: schema.config.value })
    .from(schema.config)
    .where(eq(schema.config.key, key))
    .limit(1)

  return {
    momentTime: new Date(stored!.value),
    windowStart: config.momentsWindowStart,
    windowEnd: config.momentsWindowEnd,
  }
}

/**
 * Check if moment notifications have already been sent today.
 */
export async function haveMomentNotificationsBeenSent(): Promise<boolean> {
  const today = getTodayKey()
  const key = `moment_notified_${today}`

  const [existing] = await db
    .select({ value: schema.config.value })
    .from(schema.config)
    .where(eq(schema.config.key, key))
    .limit(1)

  return !!existing
}

/**
 * Mark that moment notifications have been sent today.
 */
export async function markMomentNotificationsSent(): Promise<void> {
  const today = getTodayKey()
  const key = `moment_notified_${today}`

  await db.insert(schema.config).values({
    key,
    value: '1',
  }).onConflictDoNothing()
}

/**
 * Check if moment expiry notifications have already been sent today.
 */
export async function haveMomentExpiryBeenSent(): Promise<boolean> {
  const today = getTodayKey()
  const key = `moment_expired_${today}`

  const [existing] = await db
    .select({ value: schema.config.value })
    .from(schema.config)
    .where(eq(schema.config.key, key))
    .limit(1)

  return !!existing
}

/**
 * Mark that moment expiry notifications have been sent today.
 */
export async function markMomentExpirySent(): Promise<void> {
  const today = getTodayKey()
  const key = `moment_expired_${today}`

  await db.insert(schema.config).values({
    key,
    value: '1',
  }).onConflictDoNothing()
}

/**
 * Send initial moment notifications to all eligible users.
 * Creates in-app notification with notificationTag and sends push with countdown text.
 * Skips users who have already captured today.
 */
export async function sendMomentNotifications(): Promise<void> {
  const config = getAdminConfig()
  if (!config.momentsEnabled) return

  const { momentTime } = await getOrCreateTodayMomentTime()
  const windowEnd = new Date(momentTime.getTime() + config.momentsCaptureDuration * 1000)
  const remainingSeconds = Math.max(0, Math.ceil((windowEnd.getTime() - Date.now()) / 1000))
  const remainingMinutes = Math.ceil(remainingSeconds / 60)

  // Find all users who are members of at least one group with momentsEnabled
  const eligibleUsers = await db
    .selectDistinct({ userId: schema.groupMembers.userId })
    .from(schema.groupMembers)
    .innerJoin(schema.groups, eq(schema.groupMembers.groupId, schema.groups.id))
    .where(eq(schema.groups.momentsEnabled, true))

  for (const { userId } of eligibleUsers) {
    // Skip users who already captured today
    const captured = await hasUserCapturedMomentToday(userId)
    if (captured) continue

    const tag = generateMomentTag(userId)
    const body = `Your moment is ready! Capture within ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`

    // Create in-app notification with notificationTag
    const [notification] = await db
      .insert(schema.notifications)
      .values({
        userId,
        actorId: userId,
        type: 'moment',
        notificationTag: tag,
        isRead: false,
      })
      .returning({ id: schema.notifications.id })

    // Send push notification
    sendPushNotification(userId, {
      title: config.instanceName || 'Collct',
      body,
      icon: '/icon-192x192.png',
      tag,
      navigate: '/?moment=capture',
      data: {
        notificationId: notification?.id ?? 0,
        type: 'moment',
        status: 'active',
      },
    }).catch(() => {})
  }
}

/**
 * Send expiry notifications to all users with active moment notifications.
 * Updates the in-app notification body and sends a replacement push.
 * Called when the moment window closes.
 */
export async function sendMomentExpiryNotifications(): Promise<void> {
  const config = getAdminConfig()
  if (!config.momentsEnabled) return

  const alreadySent = await haveMomentExpiryBeenSent()
  if (alreadySent) return

  const today = getTodayKey()

  // Find all active (unread) moment notifications for today
  const activeNotifications = await db
    .select({
      id: schema.notifications.id,
      userId: schema.notifications.userId,
      notificationTag: schema.notifications.notificationTag,
    })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.type, 'moment'),
        eq(schema.notifications.isRead, false),
        sql`${schema.notifications.notificationTag} LIKE ${`moment_%_${today}`}`,
      ),
    )

  if (activeNotifications.length === 0) {
    await markMomentExpirySent()
    return
  }

  const body = "You missed today's moment, but you can still post to the feed like usual"

  for (const n of activeNotifications) {
    // Update in-app notification body
    await db
      .update(schema.notifications)
      .set({ isRead: true })
      .where(eq(schema.notifications.id, n.id))

    // Send expiry push (same tag = replaces countdown notification)
    sendPushNotification(n.userId, {
      title: config.instanceName || 'Collct',
      body,
      icon: '/icon-192x192.png',
      tag: n.notificationTag!,
      navigate: '/?moment=capture',
      data: {
        notificationId: n.id,
        type: 'moment',
        status: 'expired',
      },
    }).catch(() => {})
  }

  await markMomentExpirySent()
}

/**
 * Dismiss the active moment notification for a specific user.
 * Called when the user captures a moment.
 */
export async function dismissMomentNotification(userId: number): Promise<void> {
  const tag = generateMomentTag(userId)

  await db
    .update(schema.notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(schema.notifications.userId, userId),
        eq(schema.notifications.notificationTag, tag),
        eq(schema.notifications.isRead, false),
      ),
    )
}

/**
 * Determine the current moment status for a user.
 */
export function getMomentStatus(
  momentTime: Date,
  captureDuration: number,
): 'before' | 'active' | 'after' {
  const now = new Date()
  const windowEnd = new Date(momentTime.getTime() + captureDuration * 1000)

  if (now < momentTime) return 'before'
  if (now <= windowEnd) return 'active'
  return 'after'
}

/**
 * Check if a user has already captured a moment today.
 */
export async function hasUserCapturedMomentToday(userId: number): Promise<boolean> {
  const today = getTodayKey()
  const startOfDay = new Date(`${today}T00:00:00`)
  const startOfNextDay = new Date(`${today}T00:00:00`)
  startOfNextDay.setDate(startOfNextDay.getDate() + 1)

  const [existing] = await db
    .select({ id: schema.photos.id })
    .from(schema.photos)
    .where(
      and(
        eq(schema.photos.userId, userId),
        eq(schema.photos.isMoment, true),
        gte(schema.photos.momentCapturedAt, startOfDay),
        lt(schema.photos.momentCapturedAt, startOfNextDay),
      ),
    )
    .limit(1)

  return !!existing
}

/**
 * Get groups where the user can post moments.
 * A group qualifies if it has momentsEnabled = true and the user is a member.
 */
export async function getUserMomentsGroups(userId: number): Promise<Array<{ id: number; name: string; slug: string; icon: string | null; color: string | null; isPublic: boolean }>> {
  return db
    .select({
      id: schema.groups.id,
      name: schema.groups.name,
      slug: schema.groups.slug,
      icon: schema.groups.icon,
      color: schema.groups.color,
      isPublic: schema.groups.isPublic,
    })
    .from(schema.groups)
    .innerJoin(schema.groupMembers, eq(schema.groupMembers.groupId, schema.groups.id))
    .where(
      and(
        eq(schema.groupMembers.userId, userId),
        eq(schema.groups.momentsEnabled, true),
      ),
    )
}
