import { apiRequest } from './client'
import type { ParkingSpot, User } from './types'

export function listAdminParking(page = 0, q = '', scope = 'pending') {
  return apiRequest<{ items: ParkingSpot[]; total: number; page: number; pageSize: number }>(`/admin/parking?${new URLSearchParams({ page: String(page), q, scope })}`)
}

export function updateAdminParkingStatus(id: string, action: 'approve' | 'disable', reason?: string) {
  return apiRequest<ParkingSpot>(`/admin/parking/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ action, reason }) })
}

export function listAdminUsers() { return apiRequest<User[]>('/admin/users') }
