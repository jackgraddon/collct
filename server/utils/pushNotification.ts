import webpush from 'web-push'
import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'

interface PushMessage {
  title: string
  body: string
  icon?: string
  tag?: string
  navigate: string
  data?: Record<string, string | number>
}

let configured = false

async function configureVapid() {
  if (configured) return
  const keys = await getVapidKeys()
  const adminConfig = getAdminConfig()
  webpush.setVapidDetails(
    `mailto:${adminConfig.adminEmail}`,
    keys.publicKey,
    keys.privateKey,
  )
  configured = true
}

/**
 * Send a push notification using the W3C Declarative Web Push format.
 *
 * Browsers that support declarative push (Safari 18.4+) display the
 * notification natively from the payload. Older browsers fall back to
 * the service worker, which parses the same JSON and calls
 * showNotification() manually.
 *
 * @see https://w3c.github.io/push-api/#declarative-push-message
 * @see https://webkit.org/blog/16535/meet-declarative-web-push/
 */
export async function sendPushNotification(userId: number, message: PushMessage) {
  await configureVapid()
  if (!configured) return

  const subscriptions = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, userId))

  if (!subscriptions.length) return

  // Declarative Web Push envelope
  // web_push: 8030 — magic value that opts into declarative parsing
  // mutable: true — fires push event to service worker for optional
  //   enhancement (e.g. dismiss tracking via notificationclose)
  const payload = JSON.stringify({
    web_push: 8030,
    mutable: true,
    notification: {
      title: message.title,
      body: message.body,
      icon: message.icon || '/icon-192x192.png',
      tag: message.tag || 'collct-notification',
      navigate: message.navigate,
      data: message.data || {},
    },
  })

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
