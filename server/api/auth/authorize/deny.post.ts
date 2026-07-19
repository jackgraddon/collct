import { db, schema } from '@nuxthub/db'
import { eq, and, gt } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  code: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)

  await db
    .update(schema.pendingAuthorizations)
    .set({ status: 'denied' })
    .where(
      and(
        eq(schema.pendingAuthorizations.authorizationCode, body.code),
        eq(schema.pendingAuthorizations.type, 'authorization_code'),
        eq(schema.pendingAuthorizations.status, 'pending'),
        gt(schema.pendingAuthorizations.expiresAt, new Date()),
      ),
    )

  return { ok: true }
})
