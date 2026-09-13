import { useEffect, useState } from 'react'
import { loadOnboarding, saveOnboarding, type OnboardingPreference } from './state'

export function useOnboarding() {
  const [state, setState] = useState(loadOnboarding)
  const [mode, setMode] = useState<'intro' | 'preferences' | null>(() => state.completed ? null : 'intro')
  const [storageAvailable, setStorageAvailable] = useState(true)
  useEffect(() => { setStorageAvailable(saveOnboarding(state)) }, [state])

  return {
    mode,
    preferences: state.preferences,
    storageAvailable,
    restart: () => setMode('intro'),
    editPreferences: () => setMode('preferences'),
    cancelEdit: () => setMode(null),
    finish: (preferences: OnboardingPreference[]) => {
      const next = { ...state, completed: true, preferences }
      // Save before exposing the map, including when the tab closes immediately afterward.
      saveOnboarding(next)
      setState(next)
      setMode(null)
    },
  }
}
