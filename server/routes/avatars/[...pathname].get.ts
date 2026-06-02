import { blob } from '@nuxthub/blob'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  
  const { pathname } = getRouterParams(event)
  if (!pathname || !pathname.startsWith('avatars/')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return blob.serve(event, pathname)
})