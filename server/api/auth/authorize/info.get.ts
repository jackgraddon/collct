import { db, schema } from '@nuxthub/db'
import { eq, and, gt } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const code = getQuery(event).code as string

  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Missing code parameter' })
  }

  const auth = await db.query.pendingAuthorizations.findFirst({
    where: and(
      eq(schema.pendingAuthorizations.authorizationCode, code),
      eq(schema.pendingAuthorizations.type, 'authorization_code'),
      eq(schema.pendingAuthorizations.status, 'pending'),
      gt(schema.pendingAuthorizations.expiresAt, new Date()),
    ),
  })

  if (!auth) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or expired code' })
  }

  return { app_name: auth.appName || 'Unknown App' }
})
