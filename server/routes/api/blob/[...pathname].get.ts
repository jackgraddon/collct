export default defineEventHandler(async (event) => {
  const { pathname } = getRouterParams(event)

  if (!pathname || !(pathname.startsWith('photos/') || pathname.startsWith('avatars/'))) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  return blob.serve(event, pathname)
})