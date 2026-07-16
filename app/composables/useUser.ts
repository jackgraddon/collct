export function useUser() {
  const { user: sessionUser, clear, fetch: refreshSession } = useUserSession()

  const { data, refresh } = useFetch('/api/user/me')

  const user = computed(() => {
    const s = sessionUser.value
    if (!s) return null
    const resolved = data.value
    return {
      id: resolved?.id ?? s.id,
      name: resolved?.name ?? s.name,
      username: resolved?.username ?? s.username,
      email: s.email,
      avatarUrl: resolved?.avatarUrl ?? null,
      hasSeenOobe: resolved?.hasSeenOobe ?? false,
    }
  })

  return { user, refresh, refreshSession, sessionUser, clear }
}
