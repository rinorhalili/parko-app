import { apiRequest } from './client'
import type { ParkingSpot, ParkingStatus, User } from './types'

export function listAdminParking() { return apiRequest<ParkingSpot[]>('/admin/parking') }

export function updateAdminParkingStatus(id: string, status: ParkingStatus) {
  return apiRequest<ParkingSpot>(`/admin/parking/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) })
}

export function listAdminUsers() { return apiRequest<User[]>('/admin/users') }
