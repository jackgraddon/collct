export const usePushNotifications = () => {
  const config = useRuntimeConfig()

  const DISMISS_KEY = 'collct-push-prompt-dismissed'
  const DISMISS_DAYS = 7
  // Key the current subscription was created with. Compared against the
  // server key on init so VAPID rotations self-heal via resubscribe.
  const SUBSCRIBED_KEY = 'collct-vapid-key'

  const isSupported = computed(() => {
    return import.meta.client
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window
  })

  const isSubscribed = ref(false)
  const permission = ref<NotificationPermission>('default')
  const dismissed = ref(false)
  const keyAvailable = ref(false)

  /**
   * Resolve the VAPID public key: baked-in runtime config if present,
   * otherwise fetched live from the server (keys are auto-generated and
   * DB-backed since the server no longer bakes them into the build).
   */
  async function getServerKey(): Promise<string | null> {
    if (config.public.vapidPublicKey) return config.public.vapidPublicKey as string
    try {
      const res = await $fetch<{ vapidPublicKey: string }>('/api/notifications/vapid-key')
      return res?.vapidPublicKey || null
    } catch {
      return null
    }
  }

  const shouldPrompt = computed(() => {
    if (!isSupported.value || !keyAvailable.value) return false
    if (permission.value === 'denied') return false
    if (permission.value === 'granted') return false
    if (dismissed.value) return false
    // Check localStorage cooldown
    if (import.meta.client) {
      const stored = localStorage.getItem(DISMISS_KEY)
      if (stored) {
        const dismissedAt = Number(stored)
        const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24)
        if (daysSince < DISMISS_DAYS) return false
      }
    }
    return true
  })

  function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    const buffer = new ArrayBuffer(rawData.length)
    const view = new Uint8Array(buffer)
    for (let i = 0; i < rawData.length; i++) {
      view[i] = rawData.charCodeAt(i)
    }
    return buffer
  }

  async function requestPermission() {
    if (!isSupported.value) return false

    // Must be called from a user gesture on iOS
    const result = await Notification.requestPermission()
    permission.value = result

    if (result === 'granted') {
      await subscribe()
      return true
    }

    return false
  }

  async function subscribe() {
    if (!isSupported.value) return

    permission.value = Notification.permission
    if (permission.value !== 'granted') return

    const vapidPublicKey = await getServerKey()
    if (!vapidPublicKey) {
      console.warn('[push] No VAPID key available; skipping subscribe')
      return
    }
    keyAvailable.value = true

    try {
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()

      if (existing) {
        localStorage.setItem(SUBSCRIBED_KEY, vapidPublicKey)
        isSubscribed.value = true
        return existing
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })

      await $fetch('/api/notifications/subscribe', {
        method: 'POST',
        body: subscription.toJSON(),
      })

      localStorage.setItem(SUBSCRIBED_KEY, vapidPublicKey)
      isSubscribed.value = true
      return subscription
    } catch (err) {
      console.error('[push] Subscribe failed:', err)
    }
  }

  async function removeSubscription(registration: ServiceWorkerRegistration, subscription: PushSubscription) {
    await $fetch('/api/notifications/unsubscribe', {
      method: 'POST',
      body: { endpoint: subscription.endpoint },
    }).catch(() => {})
    await subscription.unsubscribe().catch(() => {})
    isSubscribed.value = false
  }

  async function unsubscribe() {
    if (!isSupported.value) return

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await removeSubscription(registration, subscription)
      }
    } catch (err) {
      console.error('[push] Unsubscribe failed:', err)
    }
  }

  function dismissPrompt() {
    dismissed.value = true
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  }

  async function checkSubscription() {
    if (!isSupported.value) return
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      permission.value = Notification.permission
      if (!subscription) {
        isSubscribed.value = false
        return
      }

      // Detect server VAPID rotation: the subscription is bound to the old
      // key and will never deliver again — drop it and resubscribe.
      // Skipped when the server key is unreachable (offline) to avoid
      // destroying a working subscription on a failed fetch.
      const serverKey = await getServerKey()
      keyAvailable.value = !!serverKey
      if (serverKey) {
        const subscribedKey = localStorage.getItem(SUBSCRIBED_KEY)
        if (subscribedKey && subscribedKey !== serverKey) {
          console.log('[push] VAPID key changed; resubscribing')
          await removeSubscription(registration, subscription)
          await subscribe()
          return
        }
        localStorage.setItem(SUBSCRIBED_KEY, serverKey)
      }

      isSubscribed.value = true
    } catch {
      // SW not ready yet
    }
  }

  // Check on init
  if (import.meta.client && 'Notification' in window) {
    permission.value = Notification.permission
    checkSubscription()
  }

  return {
    isSupported,
    isSubscribed,
    permission,
    shouldPrompt,
    subscribe,
    unsubscribe,
    requestPermission,
    dismissPrompt,
    checkSubscription,
  }
}
