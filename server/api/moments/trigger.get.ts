import {
  getOrCreateTodayMomentTime,
  haveMomentNotificationsBeenSent,
  markMomentNotificationsSent,
  sendMomentNotifications,
} from '../../utils/moments'

/**
 * Server-side trigger for computing the daily moment time and sending notifications.
 * Protected by CRON_SECRET — intended for external cron services (cron-job.org,
 * GitHub Actions) and Vercel Cron. No user authentication required.
 *
 * Idempotent — safe to call multiple times. Notifications are sent at most once per day.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const secret = config.cronSecret

  if (!secret) {
    throw createError({ statusCode: 500, statusMessage: 'CRON_SECRET not configured' })
  }

  // Validate bearer token
  const authHeader = getHeader(event, 'authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (token !== secret) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const adminConfig = getAdminConfig()
  if (!adminConfig.momentsEnabled) {
    return { ok: true, momentTime: null, notificationsSent: false, reason: 'moments disabled' }
  }

  // Compute/get today's moment time
  const { momentTime } = await getOrCreateTodayMomentTime()

  // Idempotent notification fan-out
  const alreadySent = await haveMomentNotificationsBeenSent()
  if (!alreadySent) {
    await sendMomentNotifications()
    await markMomentNotificationsSent()
  }

  return {
    ok: true,
    momentTime: momentTime.toISOString(),
    notificationsSent: !alreadySent,
  }
})
