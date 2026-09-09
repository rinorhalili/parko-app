import { apiRequest } from './client'

export type ParkedHistory = {
  id: string
  userId: string
  parkingSpotId: string | null
  latitude: number
  longitude: number
  note: string | null
  parkedAt: string
  leftAt: string | null
}

export type RecordParkedLocationInput = { latitude: number; longitude: number; parkingSpotId?: string; note?: string }

export function recordParkedLocation(input: RecordParkedLocationInput) {
  return apiRequest<ParkedHistory>('/parking-history', { method: 'POST', body: JSON.stringify(input) })
}

export function listParkedHistory() {
  return apiRequest<ParkedHistory[]>('/parking-history')
}
