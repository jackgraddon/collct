import { db, schema } from '@nuxthub/db'
import { z } from 'zod'

const bodySchema = z.object({
  name: z.string().min(1, 'Token name is required').max(100),
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId: number = session.user.id

  const body = await readValidatedBody(event, bodySchema.parse)

  const { raw, hash } = createApiToken()

  const [token] = await db
    .insert(schema.apiTokens)
    .values({
      userId,
      name: body.name,
      tokenHash: hash,
    })
    .returning()

  if (!token) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create token' })
  }

  return {
    id: token.id,
    name: token.name,
    token: raw,
    createdAt: token.createdAt,
  }
})
