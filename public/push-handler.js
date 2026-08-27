// Push notification handler — imported into the Workbox-generated service worker
// via workbox.importScripts in nuxt.config.ts
//
// Supports two payload formats:
// - Declarative Web Push (web_push: 8030): Browser shows notification natively.
//   Service worker runs showNotification() for Safari replacement + Chrome/Firefox display.
// - Legacy: Service worker calls showNotification() manually (older browsers).
//
// notificationclose is intentionally not handled — OS-level dismiss does not
// modify server state. In-app dismiss uses PATCH /api/notifications/:id/dismiss.

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: 'Collct', body: event.data.text() }
  }

  // Declarative Web Push — extract from envelope
  const isDwp = data.web_push === 8030 && data.notification
  const notif = isDwp ? data.notification : data

  const options = {
    body: notif.body,
    icon: notif.icon || '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: notif.tag || 'collct-notification',
    data: { ...notif.data, navigate: notif.navigate },
  }

  event.waitUntil(self.registration.showNotification(notif.title || 'Collct', options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = event.notification.data || {}
  const navigate = data.navigate

  // Use navigate URL if present, otherwise compute from data
  let url = navigate || '/'
  if (!navigate) {
    if (data.type === 'moment') {
      url = '/?moment=capture'
    } else if (data.photoId) {
      url = `/post/${data.photoId}`
    } else if (data.groupId) {
      url = `/groups/${data.groupId}`
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.focus()
          client.navigate(url)
          return
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
