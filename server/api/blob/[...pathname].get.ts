import { blob } from 'hub:blob'

export default defineEventHandler(async (event) => {
  if (!process.dev) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const pathname = getRouterParam(event, 'pathname')

  if (!pathname) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  return blob.serve(event, pathname)
})
