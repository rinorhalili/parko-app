import { apiRequest } from './client'
import type { ParkingSpot, User } from './types'
export type AdminParkingPointType = 'public' | 'street' | 'prishtina' | 'private'

export function listAdminParking(page = 0, q = '', scope = 'pending') {
  return apiRequest<{ items: ParkingSpot[]; total: number; page: number; pageSize: number }>(`/admin/parking?${new URLSearchParams({ page: String(page), q, scope })}`)
}

export function updateAdminParkingStatus(id: string, action: 'approve' | 'disable', reason?: string) {
  return apiRequest<ParkingSpot>(`/admin/parking/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ action, reason }) })
}

export function createAdminParkingPoint(input: { latitude: number; longitude: number; parkingType: AdminParkingPointType; pricePerHour?: number | null }) {
  return apiRequest<ParkingSpot>('/admin/parking-points', { method: 'POST', body: JSON.stringify(input) })
}

export function updateAdminParkingPoint(id: string, input: { latitude?: number; longitude?: number; parkingType?: AdminParkingPointType; pricePerHour?: number | null }) {
  return apiRequest<ParkingSpot>(`/admin/parking-points/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export function deleteAdminParkingPoint(id: string) {
  return apiRequest<ParkingSpot>(`/admin/parking-points/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function listAdminUsers() { return apiRequest<User[]>('/admin/users') }
