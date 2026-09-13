import { apiRequest } from './client'
import type { User } from './types'

export type UpdateProfileInput = { name?: string; username?: string; avatar?: string; bio?: string }
export type ChangePasswordInput = { currentPassword: string; newPassword: string }

export function updateProfile(input: UpdateProfileInput) {
  return apiRequest<User>('/users/me', { method: 'PATCH', body: JSON.stringify(input) })
}

export function changePassword(input: ChangePasswordInput) {
  return apiRequest<{ changed: boolean }>('/users/me/password', { method: 'PATCH', body: JSON.stringify(input) })
}

export function deleteAccount(input: { currentPassword: string }) {
  return apiRequest<{ deleted: boolean }>('/users/me', { method: 'DELETE', body: JSON.stringify(input) })
}
