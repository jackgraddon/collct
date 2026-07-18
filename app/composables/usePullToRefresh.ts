export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const pullDistance = ref(0)
  const refreshing = ref(false)

  const THRESHOLD = 64
  const MAX_PULL = 140
  const DAMPENING = 0.5

  let startY = 0
  let active = false

  function onTouchStart(e: TouchEvent) {
    if (refreshing.value) return
    if (window.scrollY > 5) return
    const touch = e.touches[0]
    if (!touch) return
    startY = touch.clientY
    active = true
  }

  function onTouchMove(e: TouchEvent) {
    if (!active || refreshing.value) return
    const touch = e.touches[0]
    if (!touch) return
    const dy = touch.clientY - startY
    if (dy <= 0 || window.scrollY > 0) {
      pullDistance.value = 0
      active = false
      return
    }
    pullDistance.value = Math.min(dy * DAMPENING, MAX_PULL)
    e.preventDefault()
  }

  async function onTouchEnd() {
    if (!active) return
    active = false

    if (pullDistance.value >= THRESHOLD) {
      refreshing.value = true
      pullDistance.value = 40
      try {
        await onRefresh()
      } finally {
        refreshing.value = false
        pullDistance.value = 0
      }
    } else {
      pullDistance.value = 0
    }
  }

  onMounted(() => {
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd)
  })

  onUnmounted(() => {
    document.removeEventListener('touchstart', onTouchStart)
    document.removeEventListener('touchmove', onTouchMove)
    document.removeEventListener('touchend', onTouchEnd)
  })

  return { pullDistance, refreshing }
}
