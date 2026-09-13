import { loadPreferences } from '../persistence'

const KEY = 'parko:onboarding:v1'
export const preferenceOptions = [
  { id: 'closest', label: 'Më i afërti', detail: 'Më pak ecje deri te destinacioni' },
  { id: 'cheapest', label: 'Më i liri', detail: 'Mbaj kostot e parkingut të ulëta' },
  { id: 'available', label: 'Më shumë vende', detail: 'Përparësi parkingjeve me vende të raportuara' },
  { id: 'covered', label: 'I mbuluar', detail: 'Mbrojtje nga dielli dhe shiu' },
] as const
export type OnboardingPreference = typeof preferenceOptions[number]['id']
export type OnboardingState = {
  version: 1
  completed: boolean
  preferences: OnboardingPreference[]
}

export function loadOnboarding(): OnboardingState {
  const empty: OnboardingState = { version: 1, completed: false, preferences: [] }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw !== null) {
      const value = JSON.parse(raw)
      if (!value || value.version !== 1) return empty
      return {
        ...empty,
        completed: value.completed === true,
        preferences: preferenceOptions.filter(option => Array.isArray(value.preferences) && value.preferences.includes(option.id)).map(option => option.id),
      }
    }
    // Existing installations keep opening the map; Settings offers an explicit replay.
    // An unfinished first run writes its own marker, so legacy app preferences cannot skip it.
    const previous = loadPreferences()
    return { ...empty, completed: Boolean(previous?.selectedParkingId || previous?.mapSettings || previous?.savedParkingIds?.length) }
  } catch {
    return empty
  }
}

export function saveOnboarding(value: OnboardingState): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(value)); return true } catch { return false }
}
