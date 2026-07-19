import { db, schema } from '@nuxthub/db'
import { z } from 'zod'

const bodySchema = z.object({
  app_name: z.string().min(1).max(100).optional(),
})

export default defineEventHandler(async (event) => {
  rateLimit(`device:code:${getClientIp(event)}`, RATE_LIMITS.deviceCode)

  const body = await readValidatedBody(event, bodySchema.parse)

  const userCode = generateUserCode()
  const deviceCode = generateDeviceCode()
  const deviceCodeHashed = hashDeviceCode(deviceCode)

  const config = getAdminConfig()
  const baseUrl = config.appUrl?.split(',')[0]?.trim() || getRequestURL(event).origin

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  await db.insert(schema.pendingAuthorizations).values({
    type: 'device',
    userCode,
    deviceCodeHash: deviceCodeHashed,
    appName: body.app_name || 'Unknown App',
    status: 'pending',
    expiresAt,
  })

  return {
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: `${baseUrl}/auth/device`,
    verification_uri_complete: `${baseUrl}/auth/device?code=${userCode}`,
    expires_in: 600,
    interval: 5,
  }
})
