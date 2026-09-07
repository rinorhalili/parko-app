import type { ApiErrorBody, ApiResponse, AuthTokens } from './types'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api/v1').replace(/\/$/, '')
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? API_BASE_URL.replace(/\/api\/v1\/?$/, '')

const ACCESS_TOKEN_KEY = 'parko:access-token:v1'
const REFRESH_TOKEN_KEY = 'parko:refresh-token:v1'
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
  writeToken(REFRESH_TOKEN_KEY, tokens.refreshToken)
}

export function clearAuthTokens() {
  writeToken(ACCESS_TOKEN_KEY, null)
  writeToken(REFRESH_TOKEN_KEY, null)
}

function notifyAuthExpired() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('parko:auth-expired'))
}

async function refreshAccessToken() {
  const refreshToken = readToken(REFRESH_TOKEN_KEY)
  if (!refreshToken) return null

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refreshToken })
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

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: 'include' })
  if (response.status === 401 && retry && path !== '/auth/refresh') {
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