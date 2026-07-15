import { blob } from 'hub:blob'

export default defineEventHandler(async (event) => {
  const pathname = getRouterParam(event, 'pathname')

  if (!pathname || !pathname.startsWith('avatars/') || pathname.includes('..')) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  // In dev, serve directly from hub blob
  if (process.dev) {
    return blob.serve(event, pathname)
  }

  // In production, use presigned URL redirect (same approach as photos)
  const { presignUrl } = await import('@vercel/blob')
  const token = await getDelegationToken()
  const { presignedUrl } = await presignUrl(token, {
    pathname,
    access: 'private',
    operation: 'get',
    validUntil: Date.now() + 60 * 60 * 1000,
  })

  return sendRedirect(event, presignedUrl, 302)
})
