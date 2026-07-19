export interface AdminConfig {
  allowRegistration: 'yes' | 'invite-only' | 'no'
  publicGroupEnabled: boolean
  instanceName: string
  instanceDescription: string
  adminEmail: string
  sessionMaxAge: number
  sessionSecure: boolean
  sessionSameSite: 'lax' | 'strict' | 'none'
  requireEmailVerification: boolean
  notificationsEnabled: boolean
  commentsEnabled: boolean
  offlineModeEnabled: boolean
  appUrl: string | null
}

export const getAdminConfig = (): AdminConfig => {
  const sessionSecure = process.env.COLLCT_SESSION_SECURE !== undefined
    ? process.env.COLLCT_SESSION_SECURE === 'true'
    : process.env.NODE_ENV === 'production'

  return {
    allowRegistration: (process.env.COLLCT_ALLOW_REGISTRATION || 'yes') as 'yes' | 'invite-only' | 'no',
    publicGroupEnabled: process.env.COLLCT_PUBLIC_GROUP_ENABLED !== 'false',
    instanceName: process.env.COLLCT_INSTANCE_NAME || 'Collct',
    instanceDescription: process.env.COLLCT_INSTANCE_DESCRIPTION || 'A friends-first photo sharing app. No algorithm. No tracking. No strangers.',
    adminEmail: process.env.COLLCT_ADMIN_EMAIL || 'admin@example.com',
    sessionMaxAge: parseInt(process.env.COLLCT_SESSION_MAX_AGE || '2592000', 10),
    sessionSecure,
    sessionSameSite: (process.env.COLLCT_SESSION_SAME_SITE || 'lax') as 'lax' | 'strict' | 'none',
    requireEmailVerification: process.env.COLLCT_REQUIRE_EMAIL_VERIFICATION === 'true',
    notificationsEnabled: process.env.COLLCT_NOTIFICATIONS_ENABLED !== 'false',
    commentsEnabled: process.env.COLLCT_COMMENTS_ENABLED !== 'false',
    offlineModeEnabled: process.env.COLLCT_OFFLINE_MODE_ENABLED !== 'false',
    appUrl: process.env.COLLCT_APP_URL || null,
  }
}
