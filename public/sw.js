const reminders = new Map()
const APP_CACHE = 'parko-app-shell-v2'
const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(self.location.hostname)

self.addEventListener('install', (event) => {
  if (isLocalDevelopment) return
  event.waitUntil(Promise.all([
    self.skipWaiting(),
    caches.open(APP_CACHE).then((cache) => cache.add(new Request(self.registration.scope, { cache: 'reload' }))).catch(() => undefined),
  ]))
})
self.addEventListener('activate', (event) => event.waitUntil(
  caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key.startsWith('parko-app-shell-') && key !== APP_CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()),
))

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (isLocalDevelopment || ['localhost', '127.0.0.1'].includes(url.hostname)) return
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) caches.open(APP_CACHE).then((cache) => cache.put(request, response.clone()))
        return response
      })
      .catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        if (request.mode === 'navigate') {
          const appShell = await caches.match(self.registration.scope)
          if (appShell) return appShell
        }
        throw new Error('Offline resource unavailable')
      }),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SCHEDULE_PARKING_REMINDER') return
  const { endsAt, parkingName } = event.data
  const existing = reminders.get('parking-timer')
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() => {
    self.registration.showNotification('Koha e parkingut përfundoi', {
      body: `${parkingName} • kontrollo ose zgjat parkimin.`,
      tag: 'parking-timer',
      data: { url: self.registration.scope },
    })
  }, Math.max(0, endsAt - Date.now()))
  reminders.set('parking-timer', timer)
})

self.addEventListener('push', (event) => {
  const payload = event.data?.json() ?? {}
  event.waitUntil(self.registration.showNotification(payload.title ?? 'Parko', {
    body: payload.body ?? 'Kontrollo kohën e parkingut.',
    tag: payload.tag ?? 'parking-timer',
    data: { url: payload.url ?? self.registration.scope },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients[0]
    if (existing) return existing.focus()
    return self.clients.openWindow(event.notification.data?.url ?? self.registration.scope)
  }))
})
