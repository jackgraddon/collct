import { db, schema } from '@nuxthub/db'
import { eq, and, gte, lt } from 'drizzle-orm'

/**
 * Get today's date string in YYYY-MM-DD format (server timezone).
 */
function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10)
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
 * Send moment notifications to all eligible users.
 * Idempotency is guaranteed by the caller checking/marking the notified flag.
 */
export async function sendMomentNotifications(): Promise<void> {
  const config = getAdminConfig()
  if (!config.momentsEnabled) return

  // Find all users who are members of at least one group with momentsEnabled
  const eligibleUsers = await db
    .selectDistinct({ userId: schema.groupMembers.userId })
    .from(schema.groupMembers)
    .innerJoin(schema.groups, eq(schema.groupMembers.groupId, schema.groups.id))
    .where(eq(schema.groups.momentsEnabled, true))

  const now = new Date()
  for (const { userId } of eligibleUsers) {
    // Create in-app notification (actor is self, but we handle this specially)
    await db.insert(schema.notifications).values({
      userId,
      actorId: userId,
      type: 'moment',
      isRead: false,
    })

    // Send push notification
    sendPushNotification(userId, {
      title: config.instanceName || 'Collct',
      body: 'Time for your daily moment! Capture a photo now.',
      icon: '/icon-192x192.png',
      tag: `moment-${getTodayKey()}`,
      data: { type: 'moment' },
    }).catch(() => {})
  }
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
