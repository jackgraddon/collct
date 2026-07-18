import webpush from 'web-push'
import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'

interface PushMessage {
  title: string
  body: string
  icon?: string
  tag?: string
  data?: Record<string, string>
}

let configured = false

function configureVapid() {
  if (configured) return
  const config = useRuntimeConfig()
  if (!config.vapidPublicKey || !config.vapidPrivateKey) {
    console.error('[push] VAPID keys not configured')
    return
  }
  webpush.setVapidDetails(
    'mailto:hello@collct.app',
    config.vapidPublicKey,
    config.vapidPrivateKey,
  )
  configured = true
}

export async function sendPushNotification(userId: number, message: PushMessage) {
  configureVapid()
  if (!configured) return

  const subscriptions = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, userId))

  if (!subscriptions.length) return

  const payload = JSON.stringify(message)

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            auth: sub.authKey,
            p256dh: sub.p256dhKey,
          },
        },
        payload,
      )
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await db
          .delete(schema.pushSubscriptions)
          .where(eq(schema.pushSubscriptions.id, sub.id))
      } else {
        console.error(`[push] Failed to send to ${sub.endpoint}:`, err.message)
      }
    }
  }
}
