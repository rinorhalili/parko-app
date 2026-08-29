import type { Filters, MapSettings, ParkedSession } from './types'

const PREFERENCES_KEY = 'parko:preferences:v1'
const SESSION_KEY = 'parko:parked-session:v1'

export type PersistedPreferences = {
  filters?: Filters
  savedParkingIds?: string[]
  selectedParkingId?: string
  mapSettings?: MapSettings
  walkingMinutes?: 5 | 10 | 15
}

function readJson<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : null
  } catch {
    return null
  }
}

export function loadPreferences() {
  return readJson<PersistedPreferences>(PREFERENCES_KEY) ?? {}
}

export function savePreferences(value: PersistedPreferences) {
  try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(value)) } catch { /* Storage may be disabled. */ }
}

export function loadParkedSession() {
  return readJson<ParkedSession>(SESSION_KEY)
}

export function saveParkedSession(session: ParkedSession) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)) } catch { /* Storage may be disabled. */ }
}

export function clearParkedSession() {
  try { localStorage.removeItem(SESSION_KEY) } catch { /* Storage may be disabled. */ }
}
