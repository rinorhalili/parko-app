import { apiRequest } from './client'

export type Favorites = { parkingIds: string[]; postIds: string[] }
export type ZoneAlert = { id: string; zone: string; createdAt: string; lastNotifiedAt: string | null }

export function listFavorites() { return apiRequest<Favorites>('/favorites') }
export function saveParkingFavorite(parkingSpotId: string) { return apiRequest(`/favorites/parking/${encodeURIComponent(parkingSpotId)}`, { method: 'PUT' }) }
export function removeParkingFavorite(parkingSpotId: string) { return apiRequest<{ removed: boolean }>(`/favorites/parking/${encodeURIComponent(parkingSpotId)}`, { method: 'DELETE' }) }
export function savePostFavorite(postId: string) { return apiRequest(`/favorites/posts/${encodeURIComponent(postId)}`, { method: 'PUT' }) }
export function removePostFavorite(postId: string) { return apiRequest<{ removed: boolean }>(`/favorites/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' }) }
export function listZoneAlerts() { return apiRequest<ZoneAlert[]>('/favorites/zone-alerts') }
export function subscribeZoneAlert(zone: string) { return apiRequest<ZoneAlert>('/favorites/zone-alerts', { method: 'POST', body: JSON.stringify({ zone }) }) }
export function removeZoneAlert(zone: string) { return apiRequest<{ removed: boolean }>(`/favorites/zone-alerts/${encodeURIComponent(zone)}`, { method: 'DELETE' }) }
