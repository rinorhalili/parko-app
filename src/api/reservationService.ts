import { apiRequest } from './client'

export type Reservation = {
  id: string
  parkingSpotId: string
  userId: string
  startsAt: string
  expiresAt: string
  cancelledAt: string | null
  createdAt: string
  parkingSpot?: { id: string; title: string; address: string | null; latitude: number; longitude: number; zone: string | null; type: string }
}

export function createReservation(input: { parkingSpotId: string; startsAt: string; expiresAt: string }) {
  return apiRequest<Reservation>('/reservations', { method: 'POST', body: JSON.stringify(input) })
}

export function listMyReservations(params: { page?: number; pageSize?: number; scope?: 'active' | 'history' | 'all' } = {}) {
  const query = new URLSearchParams()
  if (params.page !== undefined) query.set('page', String(params.page))
  if (params.pageSize !== undefined) query.set('pageSize', String(params.pageSize))
  if (params.scope) query.set('scope', params.scope)
  return apiRequest<{ items: Reservation[]; total: number; page: number; pageSize: number }>(`/reservations/me?${query}`)
}

export function cancelReservation(id: string) {
  return apiRequest<{ id: string }>(`/reservations/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
