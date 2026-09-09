import { useEffect, useState } from 'react'
import { getAccessToken, restoreSession } from '../api/client'
import { me } from '../api/authService'
import type { User } from '../api/types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const loadUser = async (restore = false) => {
      setIsLoading(true)
      try {
        const token = restore ? await restoreSession() : getAccessToken()
        const currentUser = token ? await me() : null
        if (!cancelled) setUser(currentUser)
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadUser(true)
    const handleAuthChanged = () => { void loadUser() }
    window.addEventListener('parko:auth-changed', handleAuthChanged)

    return () => {
      cancelled = true
      window.removeEventListener('parko:auth-changed', handleAuthChanged)
    }
  }, [])

  return { user, isLoading }
}
