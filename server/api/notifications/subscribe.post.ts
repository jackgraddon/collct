import { db, schema } from '~~/server/utils/db'
import { eq } from 'drizzle-orm'

// The platform column is intentionally left open for future native clients.
// Today only 'web' has a sender (Web Push via VAPID, serving both classic
// service-worker push and Declarative Web Push from one subscription).
// 'ios' / 'android' rows are accepted and stored (APNs/FCM token as the
// endpoint) so clients can register ahead of server-side sender support;
// notifyUser() skips them with a warning until a sender exists.

const NATIVE_PLATFORMS = ['ios', 'android'] as const

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

  if (!body.endpoint || typeof body.endpoint !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Endpoint is required',
    })
  }

  let authKey: string | null = null
  let p256dhKey: string | null = null

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
    authKey = body.keys.auth
    p256dhKey = body.keys.p256dh
  } else if ((NATIVE_PLATFORMS as readonly string[]).includes(platform)) {
    // Native push token (APNs device token / FCM registration token).
    // Stored for future use — no sender is configured server-side yet.
    if (body.endpoint.length < 10) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid ${platform} push token`,
      })
    }
  } else {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid platform. Must be web, ios, or android.',
    })
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
      authKey,
      p256dhKey,
      userAgent: getRequestHeaders(event)['user-agent'] || null,
    })
    .onConflictDoUpdate({
      target: [schema.pushSubscriptions.userId, schema.pushSubscriptions.endpoint],
      set: {
        platform,
        authKey,
        p256dhKey,
      },
    })

  return { subscribed: true, platform, endpoint: body.endpoint }
})
