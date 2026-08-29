import { getAdminConfig } from '../utils/config'

function platformStatus(): string {
  const platforms = ['web']
  if (process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_KEY_PATH) {
    platforms.push('apns')
  }
  if (process.env.FCM_SERVICE_ACCOUNT) {
    platforms.push('fcm')
  }
  return platforms.join(', ')
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

  if (!process.env.NUXT_SESSION_PASSWORD) {
    console.warn('[Collct] NUXT_SESSION_PASSWORD not set — using default. Set a custom password for production.')
  }
})
