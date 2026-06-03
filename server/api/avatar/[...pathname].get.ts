import { blob } from 'hub:blob'

export default defineEventHandler(async (event) => {
  const pathname = getRouterParam(event, 'pathname')
  
  if (!pathname) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  // Ensure we only serve from the avatars/ directory
  // We strip the prefix if it's already there to avoid double-prefixing
  const cleanPath = pathname.replace(/^avatars\//, '')
  return blob.serve(event, `avatars/${cleanPath}`)
})