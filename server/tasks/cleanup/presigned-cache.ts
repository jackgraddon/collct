import { db, schema } from '@nuxthub/db'
import { lt } from 'drizzle-orm'

/**
 * Nitro scheduled task: remove expired presigned URL cache entries.
 * Runs daily at 02:00 UTC. Keeps the cache table tidy.
 */
export default defineTask({
  meta: {
    name: 'cleanup:presigned-cache',
    description: 'Remove expired presigned URL cache entries',
  },
  async run() {
    const result = await db
      .delete(schema.presignedUrlCache)
      .where(lt(schema.presignedUrlCache.expiresAt, new Date()))

    const deleted = result.rowCount ?? 0
    console.log(`[Cleanup] Removed ${deleted} expired presigned URL cache entries`)

    return { result: 'ok', deleted }
  },
})
