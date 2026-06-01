import { blob } from '@nuxthub/blob'

export default defineEventHandler(async (event) => {
  const { pathname } = getRouterParams(event)

  if (!pathname || !pathname.startsWith('photos/')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  // Use the modern blob SDK to serve the file
  return blob.serve(event, pathname)
})