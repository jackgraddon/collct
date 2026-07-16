export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  const user = session.user

  let avatarUrl = user.avatarUrl ?? null
  if (avatarUrl) {
    avatarUrl = await getBlobUrl(avatarUrl)
  }

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatarUrl,
  }
})