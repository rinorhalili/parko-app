type TelemetryDetails = Record<string, string | number | boolean | null | undefined>

const QUEUE_KEY = 'parko:telemetry:v1'

function safeDetails(details: TelemetryDetails) {
  return Object.fromEntries(Object.entries(details).filter(([key]) => !/query|note|address|coordinate|location/i.test(key)))
}

export function captureEvent(name: string, details: TelemetryDetails = {}) {
  const event = { name, details: safeDetails(details), at: new Date().toISOString(), path: location.pathname }
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as unknown[]
    localStorage.setItem(QUEUE_KEY, JSON.stringify([...queue.slice(-29), event]))
  } catch { /* Telemetry must never break the app. */ }
  void fetch('/api/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => undefined)
}

export function initTelemetry() {
  window.addEventListener('error', (event) => captureEvent('runtime_error', { message: event.message }))
  window.addEventListener('unhandledrejection', (event) => captureEvent('unhandled_rejection', { message: String(event.reason) }))
}
