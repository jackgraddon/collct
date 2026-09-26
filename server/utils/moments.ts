import { db, schema } from '~~/server/utils/db'
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
 * Atomically claim a once-per-day key. Returns true if this caller won the
 * claim, false if another instance (or an earlier tick) already claimed it.
 * The INSERT ... ON CONFLICT DO NOTHING ... RETURNING round-trips as a
 * single statement, so concurrent schedulers / cron ticks / app opens can't
 * double-send. Used for both the start (`moment_notified_*`) and expiry
 * (`moment_expired_*`) markers.
 */
export async function tryClaimDailyKey(key: string): Promise<boolean> {
  const [row] = await db
    .insert(schema.config)
    .values({ key, value: '1' })
    .onConflictDoNothing()
    .returning({ key: schema.config.key })

  return !!row
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
    notifyUser(userId, {
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
 *
 * Claims the day's expiry key atomically first — concurrent ticks/instances
 * can't double-send. Safe to call repeatedly; subsequent calls no-op.
 */
export async function sendMomentExpiryNotifications(): Promise<boolean> {
  const config = getAdminConfig()
  if (!config.momentsEnabled) return false

  if (!(await tryClaimDailyKey(`moment_expired_${getTodayKey()}`))) return false

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
    return true
  }

  const body = "You missed today's moment, but you can still post to the feed like usual"

  for (const n of activeNotifications) {
    // Update in-app notification body
    await db
      .update(schema.notifications)
      .set({ isRead: true })
      .where(eq(schema.notifications.id, n.id))

    // Send expiry push (same tag = replaces countdown notification)
    notifyUser(n.userId, {
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

  return true
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
 * Process moment notification fan-out for today, gated on window status.
 *
 * This is the single entry point all triggers (in-process scheduler, lazy
 * `GET /moments/today`, cron `GET /moments/trigger`, scheduled
 * `moments:daily-compute`) must use. Sending is gated on the random moment
 * time having arrived — calling early (first app open of the day, early
 * cron/scheduler tick) only computes and stores the time without notifying.
 * All sends are claim-first (`tryClaimDailyKey`), so concurrent ticks,
 * overlapping triggers, and multi-instance deployments can't double-send:
 *
 * - `before` → do nothing. Crucially the day is NOT claimed, so a later
 *   call during the window still fires.
 * - `active` → claim the day, then send start notifications once.
 * - `after` → if the start push went out, send expiry once (claimed
 *   internally). If the window passed with no start push, claim the day
 *   and stay silent — a "you missed it" push with no preceding "ready"
 *   push is noise.
 */
export async function processMomentFanout(
  momentTime: Date,
  captureDuration: number,
): Promise<{ status: 'before' | 'active' | 'after'; notificationsSent: boolean; expirySent: boolean }> {
  const status = getMomentStatus(momentTime, captureDuration)
  let notificationsSent = false
  let expirySent = false

  if (status === 'active') {
    if (await tryClaimDailyKey(`moment_notified_${getTodayKey()}`)) {
      await sendMomentNotifications()
      notificationsSent = true
    }
  } else if (status === 'after') {
    if (await tryClaimDailyKey(`moment_notified_${getTodayKey()}`)) {
      // Window passed with no start push — claim stands as the day's
      // marker, stay silent.
    } else {
      expirySent = await sendMomentExpiryNotifications()
    }
  }

  return { status, notificationsSent, expirySent }
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
