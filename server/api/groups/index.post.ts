import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id

  const body = await readValidatedBody(
    event,
    z.object({ name: z.string().trim().min(1).max(50) }).parse,
  )

  const slug = slugify(body.name)
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid group name' })
  }

  // Check slug uniqueness
  const [existing] = await db
    .select({ id: schema.groups.id })
    .from(schema.groups)
    .where(eq(schema.groups.slug, slug))
    .limit(1)

  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'A group with that name already exists' })
  }

  const result = await db.transaction(async (tx) => {
    const [group] = await tx
      .insert(schema.groups)
      .values({ name: body.name, slug, ownerId: userId })
      .returning()

    if (!group) throw createError({ statusCode: 500, statusMessage: 'Failed to create group' })

    await tx
      .insert(schema.groupMembers)
      .values({ groupId: group.id, userId, role: 'owner' })

    return group
  })

  return result
})
