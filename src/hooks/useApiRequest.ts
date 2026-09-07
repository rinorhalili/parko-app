import { useState } from 'react'
import { ApiError } from '../api/client'

export function apiErrorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Something went wrong'
}

export function publishApiError(error: unknown) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('parko:api-error', { detail: { message: apiErrorMessage(error) } }))
}

export function useApiRequest<T, Args extends unknown[] = []>(request: (...args: Args) => Promise<T>, onError = publishApiError) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)

  async function execute(...args: Args) {
    setLoading(true)
    setError(null)
    try {
      const result = await request(...args)
      setData(result)
      return result
    } catch (requestError) {
      setError(requestError)
      onError(requestError)
      throw requestError
    } finally {
      setLoading(false)
    }
  }

  return { data, error, loading, execute, reset: () => { setData(null); setError(null) } }
}