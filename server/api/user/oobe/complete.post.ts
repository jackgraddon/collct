import { eq } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const existing = await db.query.users.findFirst({
    where: eq(schema.users.id, user.id),
  })

  const toursCompleted: string[] = existing?.toursCompleted
    ? JSON.parse(existing.toursCompleted)
    : []

  if (!toursCompleted.includes('oobe-v1')) {
    toursCompleted.push('oobe-v1')
  }

  await db
    .update(schema.users)
    .set({ toursCompleted: JSON.stringify(toursCompleted) })
    .where(eq(schema.users.id, user.id))

  return { success: true }
})
