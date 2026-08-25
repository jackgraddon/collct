import { eq, and, gte, lt } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'

const ALLOWED_USERNAMES = ['test1', 'test2', 'test3'] as const

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export default defineEventHandler(async (event) => {
  if (!process.dev) {
    throw createError({ statusCode: 403, statusMessage: 'Not available in production' })
  }

  const body = await readBody(event)
  const action = body?.action as string
  const username = body?.username as string | undefined

  if (!action || !['open', 'close', 'reset', 'clearCaptured'].includes(action)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid action. Must be: open, close, reset, clearCaptured',
    })
  }

  if (action === 'clearCaptured') {
    if (!username || !(ALLOWED_USERNAMES as readonly string[]).includes(username)) {
      throw createError({
        statusCode: 400,
        statusMessage: `clearCaptured requires a valid username. Must be one of: ${ALLOWED_USERNAMES.join(', ')}`,
      })
    }
  }

  const config = getAdminConfig()
  if (!config.momentsEnabled) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Moments are not enabled on this instance. Set COLLCT_MOMENTS_ENABLED=true.',
    })
  }

  const today = getTodayKey()
  const momentTimeKey = `moment_time_${today}`
  const notifiedKey = `moment_notified_${today}`

  switch (action) {
    case 'open': {
      // Set moment time to 5 seconds ago so the window is immediately active
      const momentTime = new Date(Date.now() - 5000)

      // Upsert the moment time
      const [existing] = await db
        .select({ value: schema.config.value })
        .from(schema.config)
        .where(eq(schema.config.key, momentTimeKey))
        .limit(1)

      if (existing) {
        await db
          .update(schema.config)
          .set({ value: momentTime.toISOString(), updatedAt: new Date() })
          .where(eq(schema.config.key, momentTimeKey))
      } else {
        await db.insert(schema.config).values({
          key: momentTimeKey,
          value: momentTime.toISOString(),
        })
      }

      // Reset the notified flag so notifications fire
      await db.delete(schema.config).where(eq(schema.config.key, notifiedKey))

      // Trigger notification fan-out (same path as real trigger)
      await sendMomentNotifications()
      await markMomentNotificationsSent()

      const status = getMomentStatus(momentTime, config.momentsCaptureDuration)
      return {
        success: true,
        action: 'open',
        momentTime: momentTime.toISOString(),
        status,
        message: `Moment window opened. Status: ${status}. Notifications sent.`,
      }
    }

    case 'close': {
      // Set moment time far enough in the past to be past the capture window
      const momentTime = new Date(Date.now() - config.momentsCaptureDuration * 1000 - 60000)

      const [existing] = await db
        .select({ value: schema.config.value })
        .from(schema.config)
        .where(eq(schema.config.key, momentTimeKey))
        .limit(1)

      if (existing) {
        await db
          .update(schema.config)
          .set({ value: momentTime.toISOString(), updatedAt: new Date() })
          .where(eq(schema.config.key, momentTimeKey))
      } else {
        await db.insert(schema.config).values({
          key: momentTimeKey,
          value: momentTime.toISOString(),
        })
      }

      const status = getMomentStatus(momentTime, config.momentsCaptureDuration)
      return {
        success: true,
        action: 'close',
        momentTime: momentTime.toISOString(),
        status,
        message: `Moment window closed. Status: ${status}.`,
      }
    }

    case 'reset': {
      // Set moment time to 5 minutes in the future to guarantee "before" state
      const momentTime = new Date(Date.now() + 5 * 60 * 1000)

      const [existing] = await db
        .select({ value: schema.config.value })
        .from(schema.config)
        .where(eq(schema.config.key, momentTimeKey))
        .limit(1)

      if (existing) {
        await db
          .update(schema.config)
          .set({ value: momentTime.toISOString(), updatedAt: new Date() })
          .where(eq(schema.config.key, momentTimeKey))
      } else {
        await db.insert(schema.config).values({
          key: momentTimeKey,
          value: momentTime.toISOString(),
        })
      }

      const status = getMomentStatus(momentTime, config.momentsCaptureDuration)
      return {
        success: true,
        action: 'reset',
        momentTime: momentTime.toISOString(),
        status,
        message: `Moment window reset. Status: ${status}.`,
      }
    }

    case 'clearCaptured': {
      const user = await db.query.users.findFirst({
        where: eq(schema.users.username, username!),
      })

      if (!user) {
        throw createError({
          statusCode: 404,
          statusMessage: `User "${username}" not found.`,
        })
      }

      // Find today's moment photos for this user and unset isMoment
      const startOfDay = new Date(`${today}T00:00:00`)
      const startOfNextDay = new Date(`${today}T00:00:00`)
      startOfNextDay.setDate(startOfNextDay.getDate() + 1)

      const todayMomentPhotos = await db
        .select({ id: schema.photos.id })
        .from(schema.photos)
        .where(
          and(
            eq(schema.photos.userId, user.id),
            eq(schema.photos.isMoment, true),
            gte(schema.photos.momentCapturedAt, startOfDay),
            lt(schema.photos.momentCapturedAt, startOfNextDay),
          ),
        )

      if (todayMomentPhotos.length > 0) {
        await db
          .update(schema.photos)
          .set({ isMoment: false })
          .where(
            and(
              eq(schema.photos.userId, user.id),
              eq(schema.photos.isMoment, true),
              gte(schema.photos.momentCapturedAt, startOfDay),
              lt(schema.photos.momentCapturedAt, startOfNextDay),
            ),
          )
      }

      return {
        success: true,
        action: 'clearCaptured',
        username,
        clearedPhotos: todayMomentPhotos.length,
        message: todayMomentPhotos.length > 0
          ? `Cleared captured-today flag for ${username} (${todayMomentPhotos.length} photo(s)).`
          : `${username} has no captured moments today to clear.`,
      }
    }
  }
})
