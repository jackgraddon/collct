import { db, schema } from '@nuxthub/db'
import { blob } from 'hub:blob'
import { presignUrl } from '@vercel/blob'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 10 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id

  const form = await readFormData(event)
  const file = form.get('photo') as File | null
  const caption = (form.get('caption') as string | null)?.trim() || null
  const groupIdsRaw = form.get('groupIds') as string | null

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

  const ext = file.type.split('/')[1]!.replace('jpeg', 'jpg')
  const blobPathname = `photos/${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  await blob.put(blobPathname, arrayBuffer, {
    contentType: file.type,
    addRandomSuffix: false,
  })

  const result = await db.transaction(async (tx) => {
    const [photo] = await tx
      .insert(schema.photos)
      .values({ userId, blobPathname, caption })
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

  const token = await getDelegationToken()
  const { presignedUrl } = await presignUrl(token, {
    pathname: blobPathname,
    access: 'private',
    operation: 'get',
    validUntil: Date.now() + 60 * 60 * 1000,
  })

  return { ...result, url: presignedUrl }
})
