export function notificationsSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator
}

export async function requestReminderPermission() {
  if (!notificationsSupported()) return 'unsupported' as const
  if (Notification.permission === 'granted') return 'granted' as const
  return Notification.requestPermission()
}

export async function scheduleParkingReminder(endsAt: number, parkingName: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false
  const registration = await navigator.serviceWorker.ready
  registration.active?.postMessage({ type: 'SCHEDULE_PARKING_REMINDER', endsAt, parkingName })
  const publicKey = import.meta.env.VITE_PUSH_PUBLIC_KEY as string | undefined
  if (publicKey && registration.pushManager) {
    try {
      const padding = '='.repeat((4 - publicKey.length % 4) % 4)
      const base64 = (publicKey + padding).replace(/-/g, '+').replace(/_/g, '/')
      const key = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
      const subscription = await registration.pushManager.getSubscription()
        ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
      await fetch('/api/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription, endsAt, parkingName }),
      })
    } catch { /* Local service-worker reminder remains active. */ }
  }
  return true
}
