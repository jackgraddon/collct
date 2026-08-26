import { dismissNotification } from '../../utils/notifications'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const userId: number = session.user.id

  const id = Number(getRouterParam(event, 'id'))
  if (isNaN(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid notification ID' })

  await dismissNotification(id, userId)

  return { ok: true }
})
