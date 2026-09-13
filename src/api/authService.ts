import { apiRequest, clearAuthTokens, setAuthTokens } from './client'
import type { AuthTokens, LoginInput, RegisterInput, User } from './types'

export async function login(input: LoginInput) {
  const tokens = await apiRequest<AuthTokens>('/auth/login', { method: 'POST', body: JSON.stringify(input) })
  setAuthTokens(tokens)
  return tokens
}

export async function register(input: RegisterInput) {
  const tokens = await apiRequest<AuthTokens>('/auth/register', { method: 'POST', body: JSON.stringify(input) })
  setAuthTokens(tokens)
  return tokens
}

export function me() { return apiRequest<User>('/auth/me') }

export function requestEmailVerification() {
  return apiRequest<{ accepted: boolean; alreadyVerified: boolean }>('/auth/verify-email/request', { method: 'POST', body: JSON.stringify({}) })
}

export function verifyEmail(token: string) {
  return apiRequest<{ verified: boolean }>('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
}

export async function logout() {
  try {
    await apiRequest('/auth/logout', { method: 'POST', body: JSON.stringify({}) }, false)
  } finally {
    clearAuthTokens()
  }
}
