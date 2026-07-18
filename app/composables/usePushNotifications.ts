export const usePushNotifications = () => {
  const config = useRuntimeConfig()
  const vapidPublicKey = config.public.vapidPublicKey

  const isSupported = computed(() => {
    return import.meta.client
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window
  })

  const isSubscribed = ref(false)
  const permission = ref<NotificationPermission>('default')

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

  async function subscribe() {
    if (!isSupported.value || !vapidPublicKey) return

    permission.value = Notification.permission
    if (permission.value === 'denied') return

    if (permission.value === 'default') {
      permission.value = await Notification.requestPermission()
      if (permission.value !== 'granted') return
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()

      if (existing) {
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

      isSubscribed.value = true
      return subscription
    } catch (err) {
      console.error('[push] Subscribe failed:', err)
    }
  }

  async function unsubscribe() {
    if (!isSupported.value) return

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await $fetch('/api/notifications/unsubscribe', {
          method: 'POST',
          body: { endpoint: subscription.endpoint },
        })

        await subscription.unsubscribe()
        isSubscribed.value = false
      }
    } catch (err) {
      console.error('[push] Unsubscribe failed:', err)
    }
  }

  async function checkSubscription() {
    if (!isSupported.value) return
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      isSubscribed.value = !!subscription
      permission.value = Notification.permission
    } catch {
      // SW not ready yet
    }
  }

  return {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    checkSubscription,
  }
}
