import { db, schema } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const config = getAdminConfig()
  if (!config.notificationsEnabled) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Notifications are disabled on this instance',
      message: 'Notifications are disabled on this instance'
    })
  }

  const session = await requireUserSession(event)
  const userId: number = session.user.id
  const body = await readBody(event)

  if (!body.endpoint || !body.keys?.auth || !body.keys?.p256dh) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid subscription object',
    })
  }

  await db
    .insert(schema.pushSubscriptions)
    .values({
      userId,
      endpoint: body.endpoint,
      authKey: body.keys.auth,
      p256dhKey: body.keys.p256dh,
      userAgent: getRequestHeaders(event)['user-agent'] || null,
    })
    .onConflictDoUpdate({
      target: [schema.pushSubscriptions.userId, schema.pushSubscriptions.endpoint],
      set: {
        authKey: body.keys.auth,
        p256dhKey: body.keys.p256dh,
      },
    })

  return { success: true }
})
