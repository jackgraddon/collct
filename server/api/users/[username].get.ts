import { db, schema } from '~~/server/utils/db'
import { eq, and, asc, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const viewerId = session.user.id
  const username = getRouterParam(event, 'username')

  if (!username) {
    throw createError({ statusCode: 400, statusMessage: 'Username required' })
  }

  const profileUser = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      name: schema.users.name,
      avatarUrl: schema.users.avatarUrl,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .then((rows) => rows[0])

  if (!profileUser) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const avatarUrl = profileUser.avatarUrl
    ? await getBlobUrl(profileUser.avatarUrl)
    : null

  // Viewer-scoped photo count
  const [photoCountResult] = await db
    .select({ count: sql<number>`count(distinct ${schema.photos.id})` })
    .from(schema.photos)
    .innerJoin(schema.photoGroups, eq(schema.photos.id, schema.photoGroups.photoId))
    .innerJoin(
      schema.groupMembers,
      and(
        eq(schema.photoGroups.groupId, schema.groupMembers.groupId),
        eq(schema.groupMembers.userId, viewerId),
      ),
    )
    .where(eq(schema.photos.userId, profileUser.id))

  const photoCount = photoCountResult?.count ?? 0

  // All comments by this user
  const [commentCountResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.comments)
    .where(eq(schema.comments.userId, profileUser.id))

  const commentCount = commentCountResult?.count ?? 0

  // Groups in common
  const viewerMembers = alias(schema.groupMembers, 'viewerMembers')
  const groupsInCommon = await db
    .select({
      id: schema.groups.id,
      name: schema.groups.name,
      slug: schema.groups.slug,
      icon: schema.groups.icon,
      color: schema.groups.color,
    })
    .from(schema.groups)
    .innerJoin(
      schema.groupMembers,
      and(
        eq(schema.groups.id, schema.groupMembers.groupId),
        eq(schema.groupMembers.userId, profileUser.id),
      ),
    )
    .innerJoin(
      viewerMembers,
      and(
        eq(schema.groups.id, viewerMembers.groupId),
        eq(viewerMembers.userId, viewerId),
      ),
    )
    .orderBy(asc(schema.groups.name))

  return {
    user: {
      id: profileUser.id,
      username: profileUser.username,
      name: profileUser.name,
      avatarUrl,
      createdAt: profileUser.createdAt,
    },
    stats: {
      photoCount,
      commentCount,
      joinedDate: profileUser.createdAt,
    },
    groupsInCommon,
  }
})
