export default defineEventHandler(async (event) => {
  const config = getAdminConfig()

  if (!config.notificationsEnabled) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Notifications are disabled on this instance',
    })
  }

  const vapidPublicKey = useRuntimeConfig().vapidPublicKey

  if (!vapidPublicKey) {
    throw createError({
      statusCode: 503,
      statusMessage: 'VAPID keys not configured on this instance',
    })
  }

  return { vapidPublicKey }
})
