import { apiRequest } from './client'
import type { User } from './types'

export type UpdateProfileInput = { name?: string; username?: string; avatar?: string; bio?: string }
export type ChangePasswordInput = { currentPassword: string; newPassword: string }
export type Session = { id: string; userAgent: string | null; ipAddress: string | null; createdAt: string; expiresAt: string; revokedAt: string | null }

export function updateProfile(input: UpdateProfileInput) {
  return apiRequest<User>('/users/me', { method: 'PATCH', body: JSON.stringify(input) })
}

export function changePassword(input: ChangePasswordInput) {
  return apiRequest<{ changed: boolean }>('/users/me/password', { method: 'PATCH', body: JSON.stringify(input) })
}

export function deleteAccount(input: { currentPassword: string }) {
  return apiRequest<{ deleted: boolean }>('/users/me', { method: 'DELETE', body: JSON.stringify(input) })
}

export function listSessions() { return apiRequest<Session[]>('/users/me/sessions') }
export function revokeSession(sessionId: string) { return apiRequest<{ revoked: boolean }>(`/users/me/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }) }
export function getUserActivity(userId: string) { return apiRequest<{ items: Array<{ type: string; id: string; createdAt: string }> }>(`/users/${encodeURIComponent(userId)}/activity`) }
export function getLeaderboard() { return apiRequest<{ items: Array<{ rank: number; id: string; name: string; username: string; avatar: string | null; reputationScore: number; isVerified: boolean }> }>('/users/leaderboard/top') }

export async function downloadMyData() {
  const { getAccessToken, API_BASE_URL } = await import('./client')
  const response = await fetch(`${API_BASE_URL}/users/me/export`, { credentials: 'include', headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` } })
  if (!response.ok) throw new Error('Data export failed')
  return response.json()
}
