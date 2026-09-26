import cron from 'node-cron'
import { getOrCreateTodayMomentTime, processMomentFanout } from '../utils/moments'
import { getAdminConfig } from '../utils/config'

/**
 * Moment delivery mode switch.
 *
 * COLLCT_MOMENTS_MODE=internal registers a per-minute in-process tick
 * (node-cron) for Docker/bare-Node deployments with a persistent process.
 * The default, `external`, registers nothing — delivery comes from an
 * external cron polling GET /api/moments/trigger (required on serverless /
 * Vercel, which has no persistent process).
 *
 * Every tick is cheap: config reads plus an HH:mm comparison, with zero DB
 * access outside the fan-out band (window start → window end + capture
 * duration + 2 min grace for expiry). Inside the band each tick delegates to
 * processMomentFanout() — the single delivery method — which is window-gated
 * and claim-first, so overlapping triggers (scheduler + external cron + lazy
 * app opens) and multi-instance deployments can't double-send.
 *
 * The lazy path (GET /api/moments/today on app open) is user-driven and runs
 * in both modes.
 */

function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

function fanoutBand(): { start: string; end: string } {
  const config = getAdminConfig()
  const endMinutes = parseHm(config.momentsWindowEnd)
    + Math.ceil(config.momentsCaptureDuration / 60) + 2
  const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0')
  const endM = String(endMinutes % 60).padStart(2, '0')
  return { start: config.momentsWindowStart, end: `${endH}:${endM}` }
}

function withinFanoutBand(): boolean {
  const config = getAdminConfig()
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const band = fanoutBand()

  return nowMinutes >= parseHm(band.start) && nowMinutes <= parseHm(band.end)
}

export default defineNitroPlugin((nitroApp) => {
  const mode = getAdminConfig().momentsMode

  if (mode !== 'internal') {
    console.log('[moments] mode: external — delivery via cron on GET /api/moments/trigger (per-minute during the window) + app opens')
    return
  }

  // Guard against double-registration under dev HMR.
  if ((globalThis as any).__collctMomentScheduler) return

  const band = fanoutBand()

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

  nitroApp.hooks.hook('close', () => {
    task.stop()
    delete (globalThis as any).__collctMomentScheduler
  })

  ;(globalThis as any).__collctMomentScheduler = task
  console.log(`[moments] mode: internal — scheduler ticking every minute during the fan-out band (${band.start}–${band.end} server time)`)
})
