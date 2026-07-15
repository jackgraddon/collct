import { blob } from 'hub:blob'

export default defineEventHandler(async (event) => {
  const pathname = getRouterParam(event, 'pathname')

  if (!pathname || !pathname.startsWith('avatars/') || pathname.includes('..')) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  return blob.serve(event, pathname)
})