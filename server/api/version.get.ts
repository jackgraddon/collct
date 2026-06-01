import { db } from '@nuxthub/db'
import { sql } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const result = await db.execute(sql`SELECT sqlite_version() as version`)
  const response = result.rows[0] as { version: string }
  return { version: response?.version };
});
