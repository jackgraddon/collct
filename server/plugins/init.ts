import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { getAdminConfig } from '../utils/config'

export default defineNitroPlugin(async () => {
  const config = getAdminConfig()

  // Create Public group if enabled
  if (config.publicGroupEnabled) {
    const publicGroup = await db
      .select()
      .from(schema.groups)
      .where(eq(schema.groups.slug, 'public'))
      .then(rows => rows[0])

    if (!publicGroup) {
      await db.insert(schema.groups).values({
        name: 'Public',
        slug: 'public',
        isPublic: true,
      })
    }
  }

  // Log startup configuration (helpful for debugging)
  console.log(`[Collct] Instance: ${config.instanceName}`)
  console.log(`[Collct] Registration: ${config.allowRegistration}`)
  console.log(`[Collct] Public group: ${config.publicGroupEnabled ? 'enabled' : 'disabled'}`)
  console.log(`[Collct] Notifications: ${config.notificationsEnabled ? 'enabled' : 'disabled'}`)
  console.log(`[Collct] Comments: ${config.commentsEnabled ? 'enabled' : 'disabled'}`)
})
