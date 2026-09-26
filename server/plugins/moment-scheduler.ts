import cron from 'node-cron'
import { getOrCreateTodayMomentTime, processMomentFanout } from '../utils/moments'
import { getAdminConfig } from '../utils/config'

/**
 * In-process moment scheduler — the Docker/bare-Node answer to cron.
 *
 * Ticks every minute. Each tick is cheap: two env reads and an HH:mm string
 * comparison, with zero DB access outside the fan-out window (configured
 * window start → window end + capture duration + 2 min grace for expiry).
 * Inside that band it delegates to processMomentFanout(), which is
 * window-gated and claim-first, so overlapping triggers (this scheduler +
 * external cron + lazy app opens) and multi-instance deployments can't
 * double-send.
 *
 * External cron via GET /api/moments/trigger remains the path for
 * serverless deployments (Vercel — no persistent process) and works as a
 * backup everywhere else. Set COLLCT_MOMENTS_SCHEDULER=false to disable
 * this scheduler when an external cron owns the job.
 */

function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

function withinFanoutBand(): boolean {
  const config = getAdminConfig()
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const startMinutes = parseHm(config.momentsWindowStart)
  // Stay awake past window end long enough for the window to close plus the
  // capture duration, so the expiry push still fires on schedule.
  const endMinutes = parseHm(config.momentsWindowEnd)
    + Math.ceil(config.momentsCaptureDuration / 60) + 2

  return nowMinutes >= startMinutes && nowMinutes <= endMinutes
}

export default defineNitroPlugin(() => {
  if (!getAdminConfig().momentsScheduler) {
    console.log('[Collct] Moment scheduler disabled (COLLCT_MOMENTS_SCHEDULER=false)')
    return
  }

  // Guard against double-registration under dev HMR.
  if ((globalThis as any).__collctMomentScheduler) return

  const task = cron.schedule('* * * * *', async () => {
    try {
      const config = getAdminConfig()
      if (!config.momentsEnabled) return
      if (!withinFanoutBand()) return

      const { momentTime } = await getOrCreateTodayMomentTime()
      await processMomentFanout(momentTime, config.momentsCaptureDuration)
    } catch (err) {
      console.error('[moments] Scheduled fan-out failed:', err)
    }
  })

  ;(globalThis as any).__collctMomentScheduler = task
  console.log('[Collct] Moment scheduler: every minute during the fan-out window')
})
