export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  const user = session.user
  let signedAvatarUrl = null

  if (user.avatarPathname) {
    signedAvatarUrl = await getBlobUrl(user.avatarUrl)
  }

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatarUrl: signedAvatarUrl
  }
})