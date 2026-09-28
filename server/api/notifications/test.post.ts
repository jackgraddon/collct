/**
 * Send yourself a test push notification.
 * Unlike moment/event pushes (fire-and-forget), this returns the per-endpoint
 * delivery results so push health is directly observable — use it to
 * distinguish "timing never fired" from "delivery failed".
 */
export default defineEventHandler(async (event) => {
  const config = getAdminConfig()
  if (!config.notificationsEnabled) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Notifications are disabled on this instance',
    })
  }

  const session = await requireUserSession(event)
  const userId: number = session.user.id

  const results = await notifyUser(userId, {
    title: config.instanceName || 'Collct',
    body: 'Test notification — push delivery works.',
    icon: '/icon-192x192.png',
    tag: 'collct-test',
    navigate: '/',
    data: { type: 'test' },
  })

  return {
    tested: true,
    results: results.map(r => ({
      platform: r.platform,
      status: r.status,
      error: r.error || null,
      // Suffix only — full endpoints stay server-side.
      endpointSuffix: r.endpoint.slice(-8),
    })),
  }
})
