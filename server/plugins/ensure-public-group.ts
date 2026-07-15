/**
 * Server plugin: ensure every authenticated user is a member of the Public group.
 * Handles users who registered before the auto-join code was deployed.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', async (event) => {
    const session = await getUserSession(event)
    if (session?.user?.id) {
      await ensureUserInPublicGroup(session.user.id)
    }
  })
})
