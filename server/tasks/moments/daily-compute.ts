import {
  getOrCreateTodayMomentTime,
  haveMomentNotificationsBeenSent,
  markMomentNotificationsSent,
  sendMomentNotifications,
} from '../../utils/moments'

/**
 * Nitro scheduled task: compute today's moment time and send notifications.
 * Runs daily at 00:05 UTC. Only fires on platforms with cron support
 * (Cloudflare Workers, etc.). On Vercel, lazy computation in
 * GET /api/moments/today handles this.
 */
export default defineTask({
  meta: {
    name: 'moments:daily-compute',
    description: 'Compute daily moment time and send notifications',
  },
  async run() {
    const config = getAdminConfig()
    if (!config.momentsEnabled) {
      return { result: 'moments disabled' }
    }

    // Compute/store today's moment time
    const { momentTime } = await getOrCreateTodayMomentTime()

    // Idempotent notification fan-out
    const alreadySent = await haveMomentNotificationsBeenSent()
    if (!alreadySent) {
      await sendMomentNotifications()
      await markMomentNotificationsSent()
    }

    return {
      result: 'ok',
      momentTime: momentTime.toISOString(),
      notificationsSent: !alreadySent,
    }
  },
})
