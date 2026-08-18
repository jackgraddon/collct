// Push notification handler — imported into the Workbox-generated service worker
// via workbox.importScripts in nuxt.config.ts

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: 'Collct', body: event.data.text() }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: data.tag || 'collct-notification',
    data: data.data || {},
  }

  event.waitUntil(self.registration.showNotification(data.title || 'Collct', options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = event.notification.data
  let url = '/'

  if (data.type === 'moment') {
    url = '/?upload=moment'
  } else if (data.photoId) {
    url = `/post/${data.photoId}`
  } else if (data.groupId) {
    url = `/groups/${data.groupId}`
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
