import type { ApiErrorBody, ApiResponse, AuthTokens } from './types'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE_URL.replace(/\/api\/v1\/?$/, '') || window.location.origin

const ACCESS_TOKEN_KEY = 'parko:access-token:v1'
let refreshPromise: Promise<string | null> | null = null

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, message: string, code = 'API_ERROR') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function readToken(key: string) {
  try { return localStorage.getItem(key) } catch { return null }
}

function writeToken(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch { /* Storage may be disabled. */ }
}

export function getAccessToken() { return readToken(ACCESS_TOKEN_KEY) }

export function setAuthTokens(tokens: AuthTokens) {
  writeToken(ACCESS_TOKEN_KEY, tokens.accessToken)
  window.dispatchEvent(new Event('parko:auth-changed'))
}

export function clearAuthTokens() {
  writeToken(ACCESS_TOKEN_KEY, null)
  window.dispatchEvent(new Event('parko:auth-changed'))
}

function notifyAuthExpired() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('parko:auth-expired'))
}

async function refreshAccessToken() {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    // The refresh token lives only in the HTTP-only cookie issued by the API.
    // This keeps it out of JavaScript-accessible storage.
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(12_000)
  })
  if (!response.ok) {
    clearAuthTokens()
    notifyAuthExpired()
    return null
  }

  const payload = await response.json() as ApiResponse<AuthTokens>
  setAuthTokens(payload.data)
  return payload.data.accessToken
}

/** Restore an authenticated browser session after a reload using the secure refresh cookie. */
export async function restoreSession() {
  if (getAccessToken()) return getAccessToken()
  return refreshOnce()
}

function refreshOnce() {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const accessToken = getAccessToken()
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  let response: Response
  try {
    const timeout = AbortSignal.timeout(12_000)
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, signal, headers, credentials: 'include' })
  } catch (error) {
    if (init.signal?.aborted) throw error
    throw new ApiError(0, 'Serveri nuk përgjigjet. Provo përsëri.', 'NETWORK_ERROR')
  }
  if (response.status === 401 && retry && !['/auth/refresh', '/auth/login', '/auth/register'].includes(path)) {
    const refreshedToken = await refreshOnce()
    if (refreshedToken) return apiRequest<T>(path, init, false)
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null) as ApiResponse<T> | ApiErrorBody | null
  if (!response.ok) {
    const error = payload && 'error' in payload ? payload.error : undefined
    throw new ApiError(response.status, error?.message ?? 'Request failed', error?.code)
  }
  return payload && 'data' in payload ? payload.data : payload as T
}
