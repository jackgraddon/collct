export default defineEventHandler(async (event) => {
  const config = getAdminConfig()

  if (!config.notificationsEnabled) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Notifications are disabled on this instance',
    })
  }

  const keys = await getVapidKeys()

  return { vapidPublicKey: keys.publicKey }
})
