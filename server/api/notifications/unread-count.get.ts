import { db, schema } from '@nuxthub/db'
import { eq, and, sql, count as drizzleCount } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId: number = session.user.id

  const [result] = await db
    .select({ total: drizzleCount() })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, userId),
        eq(schema.notifications.isRead, false),
        sql`${schema.notifications.dismissedAt} IS NULL`,
      ),
    )

  return { count: result ? Number(result.total) : 0 }
})
