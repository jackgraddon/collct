import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'

const VALID_PLATFORMS = ['web', 'apns', 'fcm'] as const

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
  const body = await readBody(event)

  const platform = (body.platform || 'web') as string

  if (!VALID_PLATFORMS.includes(platform as any)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid platform. Must be web, apns, or fcm.',
    })
  }

  if (!body.endpoint || typeof body.endpoint !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Endpoint is required',
    })
  }

  if (platform === 'web') {
    if (!body.keys?.auth || !body.keys?.p256dh) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Web subscriptions require keys.auth and keys.p256dh',
      })
    }
    // Validate endpoint is a URL
    try {
      new URL(body.endpoint)
    } catch {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid endpoint URL for web subscription',
      })
    }
  } else if (platform === 'apns') {
    // APNs tokens are hex strings, typically 64 chars
    if (!/^[a-f0-9]{64}$/i.test(body.endpoint)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid APNs device token format',
      })
    }
  } else if (platform === 'fcm') {
    if (typeof body.endpoint !== 'string' || body.endpoint.length < 10) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid FCM registration token',
      })
    }
  }

  // Check if another user already has this endpoint
  const [existingOtherUser] = await db
    .select({ userId: schema.pushSubscriptions.userId })
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.endpoint, body.endpoint))
    .limit(1)

  if (existingOtherUser && existingOtherUser.userId !== userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This device is already registered to another user',
    })
  }

  await db
    .insert(schema.pushSubscriptions)
    .values({
      userId,
      platform,
      endpoint: body.endpoint,
      authKey: body.keys?.auth || null,
      p256dhKey: body.keys?.p256dh || null,
      userAgent: getRequestHeaders(event)['user-agent'] || null,
    })
    .onConflictDoUpdate({
      target: [schema.pushSubscriptions.userId, schema.pushSubscriptions.endpoint],
      set: {
        platform,
        authKey: body.keys?.auth || null,
        p256dhKey: body.keys?.p256dh || null,
      },
    })

  return { subscribed: true, platform, endpoint: body.endpoint }
})
