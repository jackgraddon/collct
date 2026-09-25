import webpush from 'web-push'
import { db, schema } from '~~/server/utils/db'
import { eq } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PushPayload {
  title: string
  body: string
  icon?: string
  tag?: string
  navigate: string
  data?: Record<string, string | number>
}

type DeliveryResult = {
  endpoint: string
  platform: string
  status: 'sent' | 'deleted' | 'failed' | 'skipped'
  error?: string
}

// ---------------------------------------------------------------------------
// VAPID setup (web push)
// ---------------------------------------------------------------------------

let vapidConfigured = false

async function configureVapid() {
  if (vapidConfigured) return
  const keys = await getVapidKeys()
  const adminConfig = getAdminConfig()
  webpush.setVapidDetails(
    `mailto:${adminConfig.adminEmail}`,
    keys.publicKey,
    keys.privateKey,
  )
  vapidConfigured = true
}

// ---------------------------------------------------------------------------
// Web Push — Declarative Web Push envelope (W3C draft, `web_push: 8030`).
//
// One payload serves both delivery paths: browsers with DWP support
// (Safari 18.4+, iOS 18.4+) display the notification natively from the
// envelope, while other browsers fall through to the service worker
// `push` handler in public/push-handler.js. Registration and transport are
// identical for both — PushManager.subscribe() with the VAPID key and an
// encrypted POST to the endpoint — so no per-subscription distinction
// is needed.
// ---------------------------------------------------------------------------

async function deliverWebPush(
  subscriptions: typeof schema.pushSubscriptions.$inferSelect[],
  message: PushPayload,
): Promise<DeliveryResult[]> {
  await configureVapid()

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

  const results: DeliveryResult[] = []

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { auth: sub.authKey!, p256dh: sub.p256dhKey! } },
        payload,
      )
      results.push({ endpoint: sub.endpoint, platform: sub.platform, status: 'sent' })
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription is permanently gone — prune it.
        await db
          .delete(schema.pushSubscriptions)
          .where(eq(schema.pushSubscriptions.id, sub.id))
        results.push({ endpoint: sub.endpoint, platform: sub.platform, status: 'deleted' })
      } else {
        console.error(`[push] Web push to ${sub.endpoint}:`, err.message)
        results.push({ endpoint: sub.endpoint, platform: sub.platform, status: 'failed', error: err.message })
      }
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Unified entry point — the single function app logic calls to notify a user.
//
// New event types should go through createNotification() in
// server/utils/notifications.ts (which builds the payload and calls this),
// not call notifyUser() directly — unless the event has no notification
// row (e.g. moment start/expiry).
//
// The `platform` column is intentionally left open: today only 'web' has a
// sender. A future native client would register with platform 'ios' or
// 'android' (APNs/FCM token as endpoint) via POST /api/notifications/subscribe,
// and dispatch would gain a branch here. Until then such rows are skipped.
// ---------------------------------------------------------------------------

export async function notifyUser(userId: number, message: PushPayload): Promise<DeliveryResult[]> {
  const subscriptions = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, userId))

  if (!subscriptions.length) return []

  const web = subscriptions.filter(s => (s.platform || 'web') === 'web')
  const future = subscriptions.filter(s => (s.platform || 'web') !== 'web')

  const results: DeliveryResult[] = []

  if (web.length) {
    results.push(...await deliverWebPush(web, message))
  }

  for (const sub of future) {
    console.warn(`[push] No sender configured for platform '${sub.platform}'; skipping ${sub.endpoint}`)
    results.push({ endpoint: sub.endpoint, platform: sub.platform, status: 'skipped', error: `no sender for platform '${sub.platform}'` })
  }

  return results
}
