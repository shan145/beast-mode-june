// Service worker for Beast Mode push notifications

self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data?.text() ?? '' } }
  const title = data.title ?? 'Beast Mode'
  const options = {
    body: data.body ?? '',
    tag: data.tag ?? 'beast-mode',
    data: data.data ?? {},
    requireInteraction: false,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      if (windowClients.length > 0) {
        windowClients[0].postMessage({ type: 'sw-navigate', url })
        return windowClients[0].focus()
      }
      return clients.openWindow(url)
    })
  )
})
