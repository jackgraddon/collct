import {
  getOrCreateTodayMomentTime,
  processMomentFanout,
} from '../../utils/moments'
import { cleanupDismissedNotifications } from '../../utils/notifications'

/**
 * Server-side trigger for computing the daily moment time and sending notifications.
 * Protected by CRON_SECRET — intended for external cron services (cron-job.org,
 * GitHub Actions, etc.). No user authentication required.
 *
 * Idempotent — safe to call multiple times. Because fan-out is gated on the
 * random moment time, poll frequently (every minute during the configured
 * window) rather than once per day: early ticks only compute/store the time,
 * and the start push fires on the first tick inside the window.
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

  // Window-gated fan-out (no-op before the moment time, expiry after close)
  const { notificationsSent, expirySent } = await processMomentFanout(
    momentTime,
    adminConfig.momentsCaptureDuration,
  )

  // Clean up old dismissed notifications
  const cleanedUp = await cleanupDismissedNotifications()

  return {
    ok: true,
    momentTime: momentTime.toISOString(),
    notificationsSent,
    expirySent,
    cleanedUp,
  }
})
