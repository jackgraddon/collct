import {
  getOrCreateTodayMomentTime,
  processMomentFanout,
  hasUserCapturedMomentToday,
  getUserMomentsGroups,
  dismissMomentNotification,
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

  // Window-gated notification fan-out: sends the start push only while the
  // window is active, the expiry push once it closes. A first request before
  // the random moment time sends nothing (and stays eligible to send later).
  const { status } = await processMomentFanout(momentTime, config.momentsCaptureDuration)

  const capturedToday = await hasUserCapturedMomentToday(userId)
  const userMomentsGroups = await getUserMomentsGroups(userId)

  // Dismiss moment notification if user has already captured
  if (capturedToday) {
    await dismissMomentNotification(userId)
  }

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
