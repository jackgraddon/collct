interface MomentState {
  enabled: boolean
  windowStart: string
  windowEnd: string
  momentTime: string | null
  captureDuration: number
  allowPostToAll: boolean
  allowLibraryFallback: boolean
  status: 'before' | 'active' | 'after' | 'disabled'
  capturedToday: boolean
  userMomentsGroups: Array<{ id: number; name: string; slug: string; icon: string | null; color: string | null; isPublic: boolean }>
}

export function useMoment() {
  const { data: momentState, refresh } = useFetch<MomentState>('/api/moments/today', {
    default: () => ({
      enabled: false,
      windowStart: '18:00',
      windowEnd: '20:00',
      momentTime: null,
      captureDuration: 300,
      allowPostToAll: true,
      allowLibraryFallback: false,
      status: 'disabled' as const,
      capturedToday: false,
      userMomentsGroups: [],
    }),
  })

  const isActive = computed(() => momentState.value?.status === 'active')
  const isBefore = computed(() => momentState.value?.status === 'before')
  const isAfter = computed(() => momentState.value?.status === 'after')
  const capturedToday = computed(() => momentState.value?.capturedToday ?? false)
  const momentsGroups = computed(() => momentState.value?.userMomentsGroups ?? [])

  // Countdown timer
  const timeRemaining = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null

  function startCountdown() {
    stopCountdown()
    if (!momentState.value?.momentTime || !isActive.value) return

    const windowEndTime = new Date(momentState.value.momentTime).getTime() + momentState.value.captureDuration * 1000

    function tick() {
      const now = Date.now()
      const remaining = Math.max(0, Math.ceil((windowEndTime - now) / 1000))
      timeRemaining.value = remaining
      if (remaining <= 0) {
        stopCountdown()
        refresh()
      }
    }

    tick()
    timer = setInterval(tick, 1000)
  }

  function stopCountdown() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  // Start countdown when status becomes active
  watch(isActive, (active) => {
    if (active) {
      startCountdown()
    } else {
      stopCountdown()
      timeRemaining.value = 0
    }
  }, { immediate: true })

  // Auto-refresh when approaching or during the window
  let refreshTimer: ReturnType<typeof setInterval> | null = null

  function startAutoRefresh() {
    stopAutoRefresh()
    refreshTimer = setInterval(() => {
      if (isActive.value || isBefore.value) {
        refresh()
      }
    }, 30_000) // Every 30 seconds
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  }

  onMounted(() => {
    startAutoRefresh()
  })

  onUnmounted(() => {
    stopCountdown()
    stopAutoRefresh()
  })

  return {
    momentState,
    refresh,
    isActive,
    isBefore,
    isAfter,
    capturedToday,
    momentsGroups,
    timeRemaining,
  }
}
