import { db, schema } from '~~/server/utils/db'
import { putBlob } from '~~/server/utils/blob-driver'
import { eq, and, inArray, gte, lte } from 'drizzle-orm'
import { z } from 'zod'
import { getOrCreateTodayMomentTime, getUserMomentsGroups, dismissMomentNotification } from '../../utils/moments'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 10 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id

  rateLimit(`upload:${userId}`, RATE_LIMITS.upload)

  const form = await readFormData(event)
  const file = form.get('photo') as File | null
  const caption = (form.get('caption') as string | null)?.trim() || null
  const groupIdsRaw = form.get('groupIds') as string | null
  const isMomentRaw = form.get('isMoment') as string | null

  if (!file || file.size === 0)
    throw createError({ statusCode: 400, statusMessage: 'No photo provided' })
  if (!ALLOWED_TYPES.includes(file.type))
    throw createError({ statusCode: 415, statusMessage: 'Unsupported file type' })
  if (file.size > MAX_BYTES)
    throw createError({ statusCode: 413, statusMessage: 'File too large. Maximum size is 10MB.' })

  // Parse groupIds from form data (JSON array string or single value)
  let groupIds: number[] = []
  if (groupIdsRaw) {
    try {
      const parsed = JSON.parse(groupIdsRaw)
      groupIds = Array.isArray(parsed) ? parsed : [Number(parsed)]
    } catch {
      groupIds = [Number(groupIdsRaw)]
    }
    groupIds = groupIds.filter((id) => !isNaN(id) && id > 0)
  }

  // Default to Public group if none specified
  if (groupIds.length === 0) {
    const pub = await ensurePublicGroup()
    groupIds = [pub.id]
  }

  // Verify user is a member of all specified groups
  const membershipChecks = await Promise.all(
    groupIds.map(async (gid) => {
      const [m] = await db
        .select({ id: schema.groupMembers.id })
        .from(schema.groupMembers)
        .where(
          and(
            eq(schema.groupMembers.groupId, gid),
            eq(schema.groupMembers.userId, userId),
          ),
        )
        .limit(1)
      return { groupId: gid, isMember: !!m }
    }),
  )

  const unauthorized = membershipChecks.filter((c) => !c.isMember)
  if (unauthorized.length > 0) {
    throw createError({
      statusCode: 403,
      statusMessage: `You are not a member of group(s): ${unauthorized.map((c) => c.groupId).join(', ')}`,
    })
  }

  // Moment validation
  let isMoment = false
  let momentCapturedAt: Date | null = null

  if (isMomentRaw === 'true') {
    const config = getAdminConfig()
    if (!config.momentsEnabled) {
      throw createError({ statusCode: 403, statusMessage: 'Moments are not enabled on this instance' })
    }

    // Check that all selected groups have moments enabled
    const groupMomentChecks = await Promise.all(
      groupIds.map(async (gid) => {
        const [g] = await db
          .select({ momentsEnabled: schema.groups.momentsEnabled })
          .from(schema.groups)
          .where(eq(schema.groups.id, gid))
          .limit(1)
        return { groupId: gid, momentsEnabled: g?.momentsEnabled ?? true }
      }),
    )
    const disabledGroups = groupMomentChecks.filter((g) => !g.momentsEnabled)
    if (disabledGroups.length > 0) {
      throw createError({
        statusCode: 403,
        statusMessage: `Moments are not enabled in group(s): ${disabledGroups.map((g) => g.groupId).join(', ')}`,
      })
    }

    // Accept client-provided capture timestamp (locked at shutter tap time)
    // Fall back to server time if not provided (backward compatibility)
    const clientTimestampRaw = form.get('momentCapturedAt') as string | null
    let capturedAt: Date
    if (clientTimestampRaw) {
      capturedAt = new Date(clientTimestampRaw)
      if (isNaN(capturedAt.getTime())) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid momentCapturedAt timestamp' })
      }
    } else {
      capturedAt = new Date()
    }

    // Validate the capture timestamp falls within the window
    // (allows late uploads as long as the photo was captured in-time)
    const { momentTime } = await getOrCreateTodayMomentTime()
    const windowEnd = new Date(momentTime.getTime() + config.momentsCaptureDuration * 1000)

    if (capturedAt < momentTime || capturedAt > windowEnd) {
      throw createError({
        statusCode: 409,
        statusMessage: capturedAt < momentTime
          ? 'The moment window has not opened yet'
          : 'The moment window has closed',
      })
    }

    isMoment = true
    momentCapturedAt = capturedAt
  }

  const ext = file.type.split('/')[1]!.replace('jpeg', 'jpg')
  const blobPathname = `photos/${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  await putBlob(blobPathname, arrayBuffer, {
    contentType: file.type,
  })

  const result = await db.transaction(async (tx) => {
    // Duplicate check inside transaction to prevent race conditions
    if (isMoment) {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayEnd = new Date()
      todayEnd.setHours(23, 59, 59, 999)

      const [existingToday] = await tx
        .select({ id: schema.photos.id })
        .from(schema.photos)
        .where(
          and(
            eq(schema.photos.userId, userId),
            eq(schema.photos.isMoment, true),
            gte(schema.photos.momentCapturedAt, todayStart),
            lte(schema.photos.momentCapturedAt, todayEnd),
          ),
        )
        .limit(1)

      if (existingToday) {
        throw createError({ statusCode: 409, statusMessage: "You've already captured your moment today" })
      }
    }

    const [photo] = await tx
      .insert(schema.photos)
      .values({
        userId,
        blobPathname,
        caption,
        isMoment,
        momentCapturedAt,
      })
      .returning()

    if (!photo) throw createError({ statusCode: 500, statusMessage: 'Failed to create photo' })

    // Insert photo→group associations
    if (groupIds.length > 0) {
      await tx
        .insert(schema.photoGroups)
        .values(groupIds.map((groupId) => ({ photoId: photo.id, groupId })))
    }

    return photo
  })

  // Dismiss moment notification if this was a moment upload
  if (isMoment) {
    await dismissMomentNotification(userId)
  }

  // Notify all group members (except the uploader), one notification per user
  const memberRows = await db
    .select({ userId: schema.groupMembers.userId, groupId: schema.groupMembers.groupId })
    .from(schema.groupMembers)
    .where(inArray(schema.groupMembers.groupId, groupIds))
  const memberGroupMap = new Map<number, number[]>()
  for (const row of memberRows) {
    if (row.userId === userId) continue
    const groups = memberGroupMap.get(row.userId) ?? []
    groups.push(row.groupId)
    memberGroupMap.set(row.userId, groups)
  }
  for (const [memberId, memberGroupIds] of memberGroupMap) {
    createNotification({
      userId: memberId,
      actorId: userId,
      type: 'new_post',
      photoId: result.id,
      groupIds: memberGroupIds,
    }).catch(() => {})
  }

  return {
    ...result,
    url: await getBlobUrl(blobPathname),
    captionEditedAt: null,
    captionHistory: null,
  }
})
