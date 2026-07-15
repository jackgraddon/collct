export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  const user = session.user

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatarUrl: user.avatarUrl ?? null,
  }
})