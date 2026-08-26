import { useDocumentVisibility } from '@vueuse/core'

export const useNotificationPolling = () => {
  const { data: unreadData, refresh: refreshUnread } = useFetch<{ count: number }>(
    '/api/notifications/unread-count',
    { key: 'notifications-unread' },
  )

  const { data: notificationsData, refresh: refreshNotifications } = useFetch<{
    notifications: Notification[]
    nextCursor: number | null
  }>('/api/notifications', {
    key: 'notifications-list',
    query: { limit: 10 },
  })

  const unreadCount = computed(() => unreadData.value?.count ?? 0)
  const notifications = computed(() => notificationsData.value?.notifications ?? [])

  let pollInterval: ReturnType<typeof setInterval> | null = null
  const isPolling = ref(false)

  async function fetchNotifications() {
    try {
      await Promise.all([refreshUnread(), refreshNotifications()])
    } catch {
      // Continue polling even if one fetch fails
    }
  }

  function startPolling() {
    if (isPolling.value) return
    isPolling.value = true
    fetchNotifications()
    pollInterval = setInterval(fetchNotifications, 10000)
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
    isPolling.value = false
  }

  if (import.meta.client) {
    const visibility = useDocumentVisibility()

    watch(visibility, (state) => {
      if (state === 'hidden') {
        stopPolling()
      } else {
        startPolling()
      }
    })

    onMounted(() => {
      if (visibility.value === 'visible') startPolling()
    })

    onUnmounted(() => stopPolling())
  }

  return {
    unreadCount,
    notifications,
    isPolling,
    refresh: fetchNotifications,
    refreshUnread,
  }
}
