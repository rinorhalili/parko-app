import { apiRequest } from './client'
import type { CreateParkingInput, NearbyParkingSpot, ParkingSpot } from './types'

export function listParking() { return apiRequest<ParkingSpot[]>('/parking') }

export function getParking(id: string) { return apiRequest<ParkingSpot>(`/parking/${encodeURIComponent(id)}`) }

export function nearbyParking(params: { lat: number; lng: number; radius?: number; status?: string; zone?: string; type?: string }) {
  const query = new URLSearchParams({ lat: String(params.lat), lng: String(params.lng) })
  for (const key of ['radius', 'status', 'zone', 'type'] as const) {
    const value = params[key]
    if (value !== undefined) query.set(key, String(value))
  }
  return apiRequest<NearbyParkingSpot[]>(`/parking/nearby?${query}`)
}

export function createParking(input: CreateParkingInput) {
  return apiRequest<ParkingSpot>('/parking', { method: 'POST', body: JSON.stringify(input) })
}