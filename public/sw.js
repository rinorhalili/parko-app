const reminders = new Map()

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SCHEDULE_PARKING_REMINDER') return
  const { endsAt, parkingName } = event.data
  const existing = reminders.get('parking-timer')
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() => {
    self.registration.showNotification('Koha e parkingut përfundoi', {
      body: `${parkingName} • kontrollo ose zgjat parkimin.`,
      tag: 'parking-timer',
      data: { url: '/' },
    })
  }, Math.max(0, endsAt - Date.now()))
  reminders.set('parking-timer', timer)
})

self.addEventListener('push', (event) => {
  const payload = event.data?.json() ?? {}
  event.waitUntil(self.registration.showNotification(payload.title ?? 'Parko', {
    body: payload.body ?? 'Kontrollo kohën e parkingut.',
    tag: payload.tag ?? 'parking-timer',
    data: { url: payload.url ?? '/' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients[0]
    if (existing) return existing.focus()
    return self.clients.openWindow(event.notification.data?.url ?? '/')
  }))
})
