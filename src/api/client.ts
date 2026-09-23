import type { ApiErrorBody, ApiResponse, AuthTokens } from './types'
import { Capacitor } from '@capacitor/core'

type SecureStorageLike = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE_URL.replace(/\/api\/v1\/?$/, '') || window.location.origin

let accessToken: string | null = null
let refreshPromise: Promise<string | null> | null = null
const REFRESH_TOKEN_KEY = 'parko:refresh-token:v1'
const isNative = Capacitor.isNativePlatform()
let secureStorage: SecureStorageLike | null = null

async function ensureSecureStorage() {
  if (!isNative || secureStorage) return secureStorage
  try {
    const mod = await import('@aparajita/capacitor-secure-storage')
    secureStorage = (mod as { SecureStorage?: SecureStorageLike }).SecureStorage ?? null
  } catch {
    secureStorage = null
  }
  return secureStorage
}

async function readNativeRefreshToken() {
  if (!isNative) return null
  const storage = await ensureSecureStorage()
  if (!storage) return null
  try { return await storage.getItem(REFRESH_TOKEN_KEY) } catch { return null }
}

async function writeNativeRefreshToken(token?: string) {
  if (!isNative || !token) return
  const storage = await ensureSecureStorage()
  if (!storage) return
  await storage.setItem(REFRESH_TOKEN_KEY, token)
}

export async function getNativeRefreshToken() {
  return readNativeRefreshToken()
}

async function removeNativeRefreshToken() {
  if (!isNative) return
  const storage = await ensureSecureStorage()
  if (!storage) return
  try { await storage.removeItem(REFRESH_TOKEN_KEY) } catch { /* Already absent or unavailable. */ }
}

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

export function getAccessToken() { return accessToken }

export function setAuthTokens(tokens: AuthTokens) {
  accessToken = tokens.accessToken
  void writeNativeRefreshToken(tokens.refreshToken).catch(() => { /* Login remains usable; refresh will require signing in again. */ })
  // Remove the legacy persisted token if a previous build created one.
  try { localStorage.removeItem('parko:access-token:v1') } catch { /* Storage may be disabled. */ }
  window.dispatchEvent(new Event('parko:auth-changed'))
}

export function clearAuthTokens() {
  accessToken = null
  void removeNativeRefreshToken()
  try { localStorage.removeItem('parko:access-token:v1') } catch { /* Storage may be disabled. */ }
  window.dispatchEvent(new Event('parko:auth-changed'))
}

function notifyAuthExpired() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('parko:auth-expired'))
}

async function refreshAccessToken() {
  const nativeRefreshToken = await readNativeRefreshToken()
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(isNative ? { 'x-parko-client': 'native' } : {})
      },
      // Web uses the HTTP-only refresh cookie; Android uses encrypted Keystore storage.
      body: JSON.stringify(nativeRefreshToken ? { refreshToken: nativeRefreshToken } : {}),
      signal: AbortSignal.timeout(12_000)
    })
  } catch {
    throw new ApiError(0, 'Serveri nuk përgjigjet. Provo përsëri.', 'NETWORK_ERROR')
  }
  if (!response.ok) {
    if (response.status === 401) {
      clearAuthTokens()
      notifyAuthExpired()
      return null
    }
    throw new ApiError(response.status, 'Lidhja me llogarinë dështoi. Provo përsëri.', 'SESSION_UNAVAILABLE')
  }

  const payload = await response.json().catch(() => null) as ApiResponse<AuthTokens> | null
  if (!payload?.data || typeof payload.data.accessToken !== 'string') {
    throw new ApiError(502, 'Serveri dha një përgjigje të pavlefshme. Provo përsëri.', 'INVALID_RESPONSE')
  }
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
  if (isNative) headers.set('x-parko-client', 'native')

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
    if (response.status === 429) {
      const seconds = Number(response.headers.get('Retry-After'))
      const wait = Number.isFinite(seconds) && seconds > 0 ? `Prit ${Math.ceil(seconds / 60)} min` : 'Prit disa minuta'
      throw new ApiError(429, `Shumë kërkesa. ${wait} dhe provo përsëri.`, 'RATE_LIMITED')
    }
    const error = payload && typeof payload === 'object' && 'error' in payload ? payload.error : undefined
    const fallback = response.status >= 500 ? 'Shërbimi nuk është i disponueshëm për momentin. Provo përsëri.' : response.status === 401 ? 'Hyr në llogari për të vazhduar.' : 'Kërkesa dështoi. Provo përsëri.'
    throw new ApiError(response.status, error?.message ?? fallback, error?.code)
  }
  if (response.status !== 204 && (!payload || typeof payload !== 'object' || !('data' in payload))) {
    throw new ApiError(502, 'Serveri dha një përgjigje të pavlefshme. Provo përsëri.', 'INVALID_RESPONSE')
  }
  return payload && 'data' in payload ? payload.data : payload as T
}
