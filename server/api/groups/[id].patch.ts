import { db, schema } from '~~/server/utils/db'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

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
  const groupId = Number(getRouterParam(event, 'id'))
  if (!groupId || isNaN(groupId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid group ID' })
  }

  // Verify admin+ membership
  const [membership] = await db
    .select()
    .from(schema.groupMembers)
    .where(
      and(
        eq(schema.groupMembers.groupId, groupId),
        eq(schema.groupMembers.userId, userId),
      ),
    )
    .limit(1)

  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    throw createError({ statusCode: 403, statusMessage: 'Only admins can update groups' })
  }

  const body = await readValidatedBody(
    event,
    z.object({
      name: z.string().trim().min(1).max(50).optional(),
      icon: z.string().trim().optional(),
      color: z.string().trim().optional(),
      momentsEnabled: z.boolean().optional(),
    }).parse,
  )

  if (body.icon !== undefined && body.icon !== '' && !isEmoji(body.icon)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid emoji. Please provide a single emoji character.' })
  }
  if (body.color !== undefined && body.color !== '' && !HEX_COLOR_RE.test(body.color)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid color. Please provide a hex color code (e.g., #3B82F6).' })
  }

  const updateData: Record<string, string | boolean | null> = {}
  if (body.name !== undefined) updateData.name = body.name
  if (body.icon !== undefined) updateData.icon = body.icon || null
  if (body.color !== undefined) updateData.color = body.color || null
  if (body.momentsEnabled !== undefined) updateData.momentsEnabled = body.momentsEnabled

  if (Object.keys(updateData).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  const [updated] = await db
    .update(schema.groups)
    .set(updateData)
    .where(eq(schema.groups.id, groupId))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Group not found' })
  }

  return updated
})
