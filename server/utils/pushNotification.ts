import webpush from 'web-push'
import { db, schema } from '~~/server/utils/db'
import { eq } from 'drizzle-orm'
import http2 from 'node:http2'
import crypto from 'node:crypto'
import fs from 'node:fs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PushPlatform = 'web' | 'apns' | 'fcm'

interface PushMessage {
  title: string
  body: string
  icon?: string
  tag?: string
  navigate: string
  data?: Record<string, string | number>
}

// ---------------------------------------------------------------------------
// Platform configs (loaded lazily)
// ---------------------------------------------------------------------------

let vapidConfigured = false

interface ApnsConfig {
  keyId: string
  teamId: string
  key: string
  production: boolean
  bundleId: string
}

interface FcmConfig {
  serviceAccount: Record<string, unknown> | null
  projectId: string
}

let apnsConfig: ApnsConfig | null = null
let fcmConfig: FcmConfig | null = null

function loadApnsConfig(): ApnsConfig | null {
  if (apnsConfig !== undefined && apnsConfig !== null) return apnsConfig

  const keyId = process.env.APNS_KEY_ID
  const teamId = process.env.APNS_TEAM_ID
  const keyPath = process.env.APNS_KEY_PATH
  const bundleId = process.env.APNS_BUNDLE_ID || 'com.collct.app'

  if (!keyId || !teamId || !keyPath) {
    apnsConfig = null
    return null
  }

  try {
    const key = fs.readFileSync(keyPath, 'utf8')
    apnsConfig = {
      keyId,
      teamId,
      key,
      production: process.env.APNS_PRODUCTION === 'true',
      bundleId,
    }
    return apnsConfig
  } catch {
    console.warn('[push] APNS_KEY_PATH unreadable; APNs notifications will fail')
    apnsConfig = null
    return null
  }
}

function loadFcmConfig(): FcmConfig | null {
  if (fcmConfig !== undefined && fcmConfig !== null) return fcmConfig

  const raw = process.env.FCM_SERVICE_ACCOUNT
  if (!raw) {
    fcmConfig = null
    return null
  }

  try {
    // If it's a file path, read it; otherwise parse as JSON
    const json = raw.startsWith('/') ? JSON.parse(fs.readFileSync(raw, 'utf8')) : JSON.parse(raw)
    fcmConfig = {
      serviceAccount: json,
      projectId: json.project_id as string,
    }
    return fcmConfig
  } catch {
    console.warn('[push] FCM_SERVICE_ACCOUNT invalid; FCM notifications will fail')
    fcmConfig = null
    return null
  }
}

// ---------------------------------------------------------------------------
// VAPID setup (web push)
// ---------------------------------------------------------------------------

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
// APNs — JWT auth + HTTP/2
// ---------------------------------------------------------------------------

function signApnsJwt(config: ApnsConfig): string {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: config.keyId })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: config.teamId,
    iat: now,
  })).toString('base64url')

  const signingInput = `${header}.${payload}`
  const sign = crypto.createSign('SHA256')
  sign.update(signingInput)
  const signature = sign.sign(config.key, 'base64url')
  sign.end()

  return `${signingInput}.${signature}`
}

function buildApnsPayload(message: PushMessage) {
  const payload: Record<string, unknown> = {
    aps: {
      alert: { title: message.title, body: message.body },
      sound: 'default',
      'mutable-content': 1,
      'content-available': 1,
    },
    // Custom data lives outside aps
    navigate: message.navigate,
    ...(message.data || {}),
  }
  if (message.tag) payload.tag = message.tag
  return payload
}

async function sendApns(subscriptions: typeof schema.pushSubscriptions.$inferSelect[], message: PushMessage) {
  const config = loadApnsConfig()
  if (!config) {
    return subscriptions.map(s => ({ endpoint: s.endpoint, status: 'skipped' as const }))
  }

  const token = signApnsJwt(config)
  const host = config.production ? 'api.push.apple.com' : 'api.sandbox.push.apple.com'
  const results: { endpoint: string; status: 'sent' | 'deleted' | 'failed'; error?: string }[] = []

  for (const sub of subscriptions) {
    try {
      const payload = JSON.stringify(buildApnsPayload(message))

      const statusCode = await new Promise<number>((resolve, reject) => {
        const session = http2.connect(`https://${host}`)
        session.on('error', (err) => {
          session.close()
          reject(err)
        })

        const req = session.request({
          ':method': 'POST',
          ':path': `/3/device/${sub.endpoint}`,
          'apns-topic': config.bundleId,
          'apns-push-type': 'alert',
          'apns-priority': '10',
          'apns-apns-id': crypto.randomUUID(),
          authorization: `bearer ${token}`,
        })

        req.on('response', (headers) => {
          resolve(Number(headers[':status']))
        })

        req.on('error', (err) => {
          session.close()
          reject(err)
        })

        req.setEncoding('utf8')
        req.on('data', () => {}) // drain
        req.on('end', () => session.close())
        req.write(payload)
        req.end()
      })

      if (statusCode === 200) {
        results.push({ endpoint: sub.endpoint, status: 'sent' })
      } else if (statusCode === 410 || statusCode === 400) {
        // Device token is no longer valid
        await db
          .delete(schema.pushSubscriptions)
          .where(eq(schema.pushSubscriptions.id, sub.id))
        results.push({ endpoint: sub.endpoint, status: 'deleted' })
      } else {
        results.push({ endpoint: sub.endpoint, status: 'failed', error: `APNs ${statusCode}` })
      }
    } catch (err: any) {
      results.push({ endpoint: sub.endpoint, status: 'failed', error: err.message })
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// FCM — HTTP v1 API with service account JWT auth
// ---------------------------------------------------------------------------

function signFcmJwt(serviceAccount: Record<string, unknown>): string {
  const sa = serviceAccount as { client_email: string; private_key: string }
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url')

  const signingInput = `${header}.${payload}`
  const sign = crypto.createSign('SHA256')
  sign.update(signingInput)
  const signature = sign.sign(sa.private_key, 'base64url')
  sign.end()

  return `${signingInput}.${signature}`
}

async function getFcmAccessToken(serviceAccount: Record<string, unknown>): Promise<string> {
  const jwt = signFcmJwt(serviceAccount)
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await resp.json() as { access_token: string }
  return data.access_token
}

function buildFcmPayload(message: PushMessage): Record<string, unknown> {
  return {
    notification: {
      title: message.title,
      body: message.body,
    },
    data: {
      navigate: message.navigate,
      tag: message.tag || 'collct-notification',
      ...(Object.fromEntries(
        Object.entries(message.data || {}).map(([k, v]) => [k, String(v)]),
      )),
    },
  }
}

async function sendFcm(subscriptions: typeof schema.pushSubscriptions.$inferSelect[], message: PushMessage) {
  const config = loadFcmConfig()
  if (!config || !config.serviceAccount) {
    return subscriptions.map(s => ({ endpoint: s.endpoint, status: 'skipped' as const }))
  }

  let accessToken: string
  try {
    accessToken = await getFcmAccessToken(config.serviceAccount)
  } catch (err: any) {
    console.error('[push] FCM token refresh failed:', err.message)
    return subscriptions.map(s => ({ endpoint: s.endpoint, status: 'failed' as const, error: 'FCM auth failed' }))
  }

  const results: { endpoint: string; status: 'sent' | 'deleted' | 'failed'; error?: string }[] = []

  for (const sub of subscriptions) {
    try {
      const payload = buildFcmPayload(message)
      const resp = await fetch(
        `https://fcm.googleapis.com/v1/projects/${config.projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: sub.endpoint,
              ...payload,
            },
          }),
        },
      )

      const result = await resp.json() as Record<string, unknown>

      if (resp.ok) {
        results.push({ endpoint: sub.endpoint, status: 'sent' })
      } else {
        const error = (result as { error?: { code?: number; message?: string } }).error
        const code = error?.code
        // Invalid registration token or unregistered
        if (code === 404 || code === 400) {
          await db
            .delete(schema.pushSubscriptions)
            .where(eq(schema.pushSubscriptions.id, sub.id))
          results.push({ endpoint: sub.endpoint, status: 'deleted' })
        } else {
          results.push({ endpoint: sub.endpoint, status: 'failed', error: error?.message || `FCM ${code}` })
        }
      }
    } catch (err: any) {
      results.push({ endpoint: sub.endpoint, status: 'failed', error: err.message })
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Web Push — existing logic (declarative web push envelope)
// ---------------------------------------------------------------------------

async function sendWebPush(subscriptions: typeof schema.pushSubscriptions.$inferSelect[], message: PushMessage) {
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

  const results: { endpoint: string; status: 'sent' | 'deleted' | 'failed'; error?: string }[] = []

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { auth: sub.authKey!, p256dh: sub.p256dhKey! } },
        payload,
      )
      results.push({ endpoint: sub.endpoint, status: 'sent' })
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await db
          .delete(schema.pushSubscriptions)
          .where(eq(schema.pushSubscriptions.id, sub.id))
        results.push({ endpoint: sub.endpoint, status: 'deleted' })
      } else {
        console.error(`[push] Web push to ${sub.endpoint}:`, err.message)
        results.push({ endpoint: sub.endpoint, status: 'failed', error: err.message })
      }
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Unified entry point — route by platform
// ---------------------------------------------------------------------------

export async function sendPushNotification(userId: number, message: PushMessage) {
  const subscriptions = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, userId))

  if (!subscriptions.length) return

  const byPlatform: Record<PushPlatform, typeof subscriptions> = {
    web: [],
    apns: [],
    fcm: [],
  }

  for (const sub of subscriptions) {
    const platform = (sub.platform as PushPlatform) || 'web'
    byPlatform[platform].push(sub)
  }

  await Promise.all([
    byPlatform.web.length ? sendWebPush(byPlatform.web, message) : Promise.resolve([]),
    byPlatform.apns.length ? sendApns(byPlatform.apns, message) : Promise.resolve([]),
    byPlatform.fcm.length ? sendFcm(byPlatform.fcm, message) : Promise.resolve([]),
  ])
}
