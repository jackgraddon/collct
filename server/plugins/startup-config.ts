import { getAdminConfig } from '../utils/config'

const DEFAULT_SESSION_PASSWORD = 'collct-default-session-key-change-me'

function platformStatus(): string {
  // Web Push (VAPID) serves both classic service-worker push and
  // Declarative Web Push from a single subscription type.
  return 'web'
}

export default defineNitroPlugin(() => {
  const config = getAdminConfig()

  console.log(`[Collct] Instance:      ${config.instanceName}`)
  console.log(`[Collct] Registration:   ${config.allowRegistration}`)
  console.log(`[Collct] Public group:    ${config.publicGroupEnabled ? 'enabled' : 'disabled'}`)
  console.log(`[Collct] Notifications:   ${config.notificationsEnabled ? 'enabled' : 'disabled'}`)
  console.log(`[Collct] Push platforms:  ${platformStatus()}`)
  console.log(`[Collct] Comments:        ${config.commentsEnabled ? 'enabled' : 'disabled'}`)
  console.log(`[Collct] Offline mode:    ${config.offlineModeEnabled ? 'enabled' : 'disabled'}`)
  console.log(`[Collct] Moments:         ${config.momentsEnabled ? 'enabled' : 'disabled'} (${config.momentsWindowStart}–${config.momentsWindowEnd}, ${config.momentsCaptureDuration}s capture, postToAll=${config.momentsAllowPostToAll}, libFallback=${config.momentsAllowLibraryFallback})`)
  console.log(`[Collct] Session max age: ${config.sessionMaxAge}s`)
  console.log(`[Collct] Admin email:     ${config.adminEmail}`)

  // --- Startup warnings ---

  const sessionPassword = process.env.NUXT_SESSION_PASSWORD
  if (!sessionPassword) {
    console.warn('[Collct] NUXT_SESSION_PASSWORD not set — using default. Set a custom password for production.')
  } else if (sessionPassword === DEFAULT_SESSION_PASSWORD && process.env.NODE_ENV === 'production') {
    console.error('[Collct] NUXT_SESSION_PASSWORD is the default value. Refusing to start in production.')
    console.error('[Collct] Generate a secure password: openssl rand -hex 32')
    process.exit(1)
  }

  if (!process.env.DATABASE_URL && process.env.DATABASE_TYPE !== 'sqlite') {
    console.warn('[Collct] DATABASE_URL not set — PostgreSQL mode requires a connection string.')
  }

  if (!process.env.COLLCT_APP_URL) {
    console.warn('[Collct] COLLCT_APP_URL not set — OAuth redirects and push notification links may be incorrect.')
  }

  if (!process.env.CRON_SECRET) {
    console.warn('[Collct] CRON_SECRET not set — moment trigger endpoint (/api/moments/trigger) will reject requests.')
  }

  if (!process.env.COLLCT_ALLOWED_ORIGINS) {
    console.warn('[Collct] COLLCT_ALLOWED_ORIGINS not set — CORS allows all origins. Set this for production security.')
  }
})
