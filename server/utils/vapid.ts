import webpush from 'web-push'
import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'

interface VapidKeys {
  publicKey: string
  privateKey: string
}

let cachedKeys: VapidKeys | null = null

export async function getVapidKeys(): Promise<VapidKeys> {
  if (cachedKeys) return cachedKeys

  // 1. Check env vars first (manual config takes precedence)
  const envPublic = process.env.VAPID_PUBLIC_KEY
  const envPrivate = process.env.VAPID_PRIVATE_KEY
  if (envPublic && envPrivate) {
    cachedKeys = { publicKey: envPublic, privateKey: envPrivate }
    return cachedKeys
  }

  // 2. Check database
  const pubRow = await db.query.config.findFirst({
    where: eq(schema.config.key, 'vapid_public_key'),
  })
  const privRow = await db.query.config.findFirst({
    where: eq(schema.config.key, 'vapid_private_key'),
  })

  if (pubRow && privRow) {
    cachedKeys = { publicKey: pubRow.value, privateKey: privRow.value }
    return cachedKeys
  }

  // 3. Generate new keys
  console.log('[collct] No VAPID keys found — generating new ones...')
  const keys = webpush.generateVAPIDKeys()

  await db
    .insert(schema.config)
    .values({ key: 'vapid_public_key', value: keys.publicKey })
    .onConflictDoUpdate({ target: schema.config.key, set: { value: keys.publicKey } })

  await db
    .insert(schema.config)
    .values({ key: 'vapid_private_key', value: keys.privateKey })
    .onConflictDoUpdate({ target: schema.config.key, set: { value: keys.privateKey } })

  cachedKeys = { publicKey: keys.publicKey, privateKey: keys.privateKey }
  console.log('[collct] VAPID keys generated and stored in database')
  return cachedKeys
}
