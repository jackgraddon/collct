import {
  getOrCreateTodayMomentTime,
  getMomentStatus,
  haveMomentNotificationsBeenSent,
  markMomentNotificationsSent,
  sendMomentNotifications,
  hasUserCapturedMomentToday,
  getUserMomentsGroups,
} from '../../utils/moments'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id

  const config = getAdminConfig()

  if (!config.momentsEnabled) {
    return {
      enabled: false,
      windowStart: config.momentsWindowStart,
      windowEnd: config.momentsWindowEnd,
      momentTime: null,
      captureDuration: config.momentsCaptureDuration,
      status: 'disabled' as const,
      capturedToday: false,
      userMomentsGroups: [],
    }
  }

  // Compute/get today's moment time (lazy primary mechanism)
  const { momentTime, windowStart, windowEnd } = await getOrCreateTodayMomentTime()

  // Idempotent notification fan-out (first request of the day triggers this)
  const alreadySent = await haveMomentNotificationsBeenSent()
  if (!alreadySent) {
    await sendMomentNotifications()
    await markMomentNotificationsSent()
  }

  const status = getMomentStatus(momentTime, config.momentsCaptureDuration)
  const capturedToday = await hasUserCapturedMomentToday(userId)
  const userMomentsGroups = await getUserMomentsGroups(userId)

  return {
    enabled: true,
    windowStart,
    windowEnd,
    momentTime: momentTime.toISOString(),
    captureDuration: config.momentsCaptureDuration,
    allowPostToAll: config.momentsAllowPostToAll,
    allowLibraryFallback: config.momentsAllowLibraryFallback,
    status,
    capturedToday,
    userMomentsGroups,
  }
})
