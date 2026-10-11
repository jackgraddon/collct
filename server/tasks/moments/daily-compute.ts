import {
  getOrCreateTodayMomentTime,
  processMomentFanout,
} from '../../utils/moments'

/**
 * Nitro scheduled task: compute today's moment time and send notifications.
 * Runs daily at 00:05 UTC. Only fires on platforms with cron support
 * (Cloudflare Workers, etc.). On Vercel, lazy computation in
 * GET /api/moments/today handles this.
 *
 * At 00:05 the window is still hours away, so this only computes and stores
 * the random time — processMomentFanout correctly sends nothing yet. The
 * start push fires on the first trigger (cron tick or app open) inside the
 * window.
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

    // Window-gated fan-out (no-op this early — sends nothing, marks nothing)
    const { notificationsSent } = await processMomentFanout(
      momentTime,
      config.momentsCaptureDuration,
    )

    return {
      result: 'ok',
      momentTime: momentTime.toISOString(),
      notificationsSent,
    }
  },
})
