import { db, schema } from '@nuxthub/db'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid photo ID' })
  }

  // Check if viewer can see this photo (must share at least one group)
  const visibleIds = await db
    .selectDistinct({ photoId: schema.photoGroups.photoId })
    .from(schema.photoGroups)
    .innerJoin(
      schema.groupMembers,
      and(
        eq(schema.groupMembers.groupId, schema.photoGroups.groupId),
        eq(schema.groupMembers.userId, userId),
      ),
    )
    .where(eq(schema.photoGroups.photoId, id))

  if (visibleIds.length === 0) {
    // 404, not 403 — don't confirm existence
    throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  }

  const [row] = await db
    .select({
      id: schema.photos.id,
      caption: schema.photos.caption,
      captionEditedAt: schema.photos.captionEditedAt,
      blobPathname: schema.photos.blobPathname,
      createdAt: schema.photos.createdAt,
      user: {
        id: schema.users.id,
        username: schema.users.username,
        name: schema.users.name,
        avatarUrl: schema.users.avatarUrl,
      },
    })
    .from(schema.photos)
    .innerJoin(schema.users, eq(schema.photos.userId, schema.users.id))
    .where(eq(schema.photos.id, id))
    .limit(1)

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  }

  const url = await getBlobUrl(row.blobPathname)
  const groupsMap = await getVisiblePhotoGroups([id], userId)

  let avatarUrl = row.user.avatarUrl
  if (avatarUrl) {
    avatarUrl = await getBlobUrl(avatarUrl)
  }

  const captionHistory: { text: string | null; editedAt: string }[] | null = row.captionEditedAt
    ? await db
        .select({ captionHistory: schema.photos.captionHistory })
        .from(schema.photos)
        .where(eq(schema.photos.id, id))
        .then((r) => (r[0]?.captionHistory ? JSON.parse(r[0].captionHistory) : null))
    : null

  return {
    ...row,
    url,
    captionHistory,
    groups: groupsMap.get(id) ?? [],
    user: { ...row.user, avatarUrl },
  }
})
