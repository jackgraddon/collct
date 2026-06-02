import { blob } from '@nuxthub/blob'

export default defineEventHandler(async (event) => {
  const { pathname } = getRouterParams(event)

  if (!pathname || !(pathname.startsWith('photos/'))) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  return blob.serve(event, pathname)
})