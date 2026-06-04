import { blob } from 'hub:blob'

export default defineEventHandler(async (event) => {
  const pathname = getRouterParam(event, 'pathname')
  
  if (!pathname) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const cleanPath = pathname.replace(/^avatars\//, '')
  return blob.serve(event, `avatars/${cleanPath}`)
})