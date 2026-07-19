import { db, schema } from '@nuxthub/db'
import { eq, and, gt } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  code: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  const auth = await db.query.pendingAuthorizations.findFirst({
    where: and(
      eq(schema.pendingAuthorizations.authorizationCode, body.code),
      eq(schema.pendingAuthorizations.type, 'authorization_code'),
      eq(schema.pendingAuthorizations.status, 'pending'),
      gt(schema.pendingAuthorizations.expiresAt, new Date()),
    ),
  })

  if (!auth) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or expired code' })
  }

  await db
    .update(schema.pendingAuthorizations)
    .set({
      status: 'approved',
      userId: user.id,
      approvedAt: new Date(),
    })
    .where(eq(schema.pendingAuthorizations.id, auth.id))

  return { ok: true }
})
