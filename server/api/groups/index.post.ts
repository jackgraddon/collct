import { db, schema } from '~~/server/utils/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function isEmoji(s: string): boolean {
  if (!s || s.length > 16) return false
  for (const char of s) {
    const cp = char.codePointAt(0)!
    const isExtendedPictographic = cp >= 0x1F000 && cp <= 0x1FFFF
    const isVariationSelector = cp === 0xFE0F || cp === 0xFE0E
    const isZWJ = cp === 0x200D
    const isSkinTone = cp >= 0x1F3FB && cp <= 0x1F3FF
    const isRegionalIndicator = cp >= 0x1F1E6 && cp <= 0x1F1FF
    if (!isExtendedPictographic && !isVariationSelector && !isZWJ && !isSkinTone && !isRegionalIndicator) {
      return false
    }
  }
  return /[\p{Extended_Pictographic}]/u.test(s)
}

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId = session.user.id

  const body = await readValidatedBody(
    event,
    z.object({
      name: z.string().trim().min(1).max(50),
      icon: z.string().trim().optional(),
      color: z.string().trim().optional(),
    }).parse,
  )

  if (body.icon !== undefined && body.icon !== '' && !isEmoji(body.icon)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid emoji. Please provide a single emoji character.' })
  }
  if (body.color !== undefined && body.color !== '' && !HEX_COLOR_RE.test(body.color)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid color. Please provide a hex color code (e.g., #3B82F6).' })
  }

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
    const insertData: { name: string; slug: string; ownerId: number; icon?: string; color?: string } = { name: body.name, slug, ownerId: userId }
    if (body.icon) insertData.icon = body.icon
    if (body.color) insertData.color = body.color

    const [group] = await tx
      .insert(schema.groups)
      .values(insertData)
      .returning()

    if (!group) throw createError({ statusCode: 500, statusMessage: 'Failed to create group' })

    await tx
      .insert(schema.groupMembers)
      .values({ groupId: group.id, userId, role: 'owner' })

    return group
  })

  return result
})
