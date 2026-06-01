export default defineEventHandler(async (event) => {
  const { pathname } = getRouterParams(event)

  if (!pathname || !pathname.startsWith('photos/')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  return hubBlob().serve(event, pathname)
})
