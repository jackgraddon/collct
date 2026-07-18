import { getAdminConfig } from '../utils/config'

export default defineNitroPlugin(() => {
  const config = getAdminConfig()

  console.log(`[Collct] Instance:      ${config.instanceName}`)
  console.log(`[Collct] Registration:   ${config.allowRegistration}`)
  console.log(`[Collct] Public group:    ${config.publicGroupEnabled ? 'enabled' : 'disabled'}`)
  console.log(`[Collct] Notifications:   ${config.notificationsEnabled ? 'enabled' : 'disabled'}`)
  console.log(`[Collct] Comments:        ${config.commentsEnabled ? 'enabled' : 'disabled'}`)
  console.log(`[Collct] Offline mode:    ${config.offlineModeEnabled ? 'enabled' : 'disabled'}`)
  console.log(`[Collct] Session max age: ${config.sessionMaxAge}s`)
  console.log(`[Collct] Admin email:     ${config.adminEmail}`)
})
