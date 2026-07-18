import { db } from '@nuxthub/db'
import { sql } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const result = await db.execute(sql`SELECT version() as version`)
  const response = result[0] as { version: string } | undefined
  return { version: response?.version };
});
