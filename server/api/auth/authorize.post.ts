import { db, schema } from '@nuxthub/db'
import { z } from 'zod'

const bodySchema = z.object({
  redirect_uri: z.string().url('Invalid redirect URI'),
  app_name: z.string().min(1).max(100).optional(),
  state: z.string().max(2048).optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)

  const authorizationCode = generateAuthorizationCode()
  const config = getAdminConfig()
  const baseUrl = config.appUrl?.split(',')[0]?.trim() || getRequestURL(event).origin

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  // Store the pending authorization — userId will be set when user approves
  await db.insert(schema.pendingAuthorizations).values({
    type: 'authorization_code',
    authorizationCode,
    appName: body.app_name || 'Unknown App',
    redirectUri: body.redirect_uri,
    status: 'pending',
    expiresAt,
  })

  // Return the authorize URL for the app to open in a browser
  const authorizeUrl = `${baseUrl}/auth/authorize?code=${authorizationCode}`

  return {
    authorize_url: authorizeUrl,
    code: authorizationCode,
    expires_in: 600,
    state: body.state,
  }
})
