import { db, schema } from '@nuxthub/db'
import { eq, and, gt } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  code: z.string().min(1),
  approve: z.boolean(),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  const auth = await db.query.pendingAuthorizations.findFirst({
    where: and(
      eq(schema.pendingAuthorizations.userCode, body.code.toUpperCase()),
      eq(schema.pendingAuthorizations.type, 'device'),
      eq(schema.pendingAuthorizations.status, 'pending'),
      gt(schema.pendingAuthorizations.expiresAt, new Date()),
    ),
  })

  if (!auth) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid, expired, or already used code' })
  }

  await db
    .update(schema.pendingAuthorizations)
    .set({
      status: body.approve ? 'approved' : 'denied',
      userId: body.approve ? user.id : null,
      approvedAt: body.approve ? new Date() : null,
    })
    .where(eq(schema.pendingAuthorizations.id, auth.id))

  return { ok: true }
})
