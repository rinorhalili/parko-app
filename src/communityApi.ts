import { supabase } from './lib/supabase'
import type { MapCoordinate, Parking } from './types'

export type CommunityAvailability = 'AVAILABLE' | 'OCCUPIED'

export type CommunityParkingReport = {
  id: string
  parkingId: string
  status: CommunityAvailability
  createdAt: number
  expiresAt: number
}

export type CommunityStreetAlert = {
  id: string
  kind: 'police' | 'spider'
  street: string
  zone: string
  createdAt: number
  expiresAt: number
}

function requiredUserId() {
  return supabase.auth.getUser().then(({ data, error }) => {
    if (error) throw error
    if (!data.user) throw new Error('Ky veprim kërkon hyrje në llogari.')
    return data.user.id
  })
}

function asReport(row: { id: string; external_parking_id: string; status: CommunityAvailability; created_at: string; expires_at: string }): CommunityParkingReport {
  return { id: row.id, parkingId: row.external_parking_id, status: row.status, createdAt: Date.parse(row.created_at), expiresAt: Date.parse(row.expires_at) }
}

function asAlert(row: { id: string; kind: string; street: string; zone: string; created_at: string; expires_at: string }): CommunityStreetAlert {
  return { id: row.id, kind: row.kind === 'SPIDER' ? 'spider' : 'police', street: row.street, zone: row.zone, createdAt: Date.parse(row.created_at), expiresAt: Date.parse(row.expires_at) }
}

export async function loadCommunityState() {
  const now = new Date().toISOString()
  const [reportsResult, alertsResult] = await Promise.all([
    supabase.from('community_parking_reports').select('id, external_parking_id, status, created_at, expires_at').gt('expires_at', now).order('created_at', { ascending: false }).limit(500),
    supabase.from('street_alerts').select('id, kind, street, zone, created_at, expires_at').gt('expires_at', now).order('created_at', { ascending: false }).limit(100),
  ])
  if (reportsResult.error) throw reportsResult.error
  if (alertsResult.error) throw alertsResult.error
  return {
    reports: reportsResult.data.map(asReport),
    alerts: alertsResult.data.map(asAlert),
  }
}

export async function submitParkingAvailability(parking: Parking, status: CommunityAvailability) {
  const reporterId = await requiredUserId()
  const { data, error } = await supabase.from('community_parking_reports').insert({
    reporter_id: reporterId,
    external_parking_id: parking.id,
    status,
    latitude: parking.coordinates.lat,
    longitude: parking.coordinates.lng,
  }).select('id, external_parking_id, status, created_at, expires_at').single()
  if (error) throw error
  return asReport(data)
}

export async function submitStreetAlert(kind: CommunityStreetAlert['kind'], street: string, zone: string, coordinate?: MapCoordinate) {
  const reporterId = await requiredUserId()
  const { data, error } = await supabase.from('street_alerts').insert({
    reporter_id: reporterId,
    kind: kind === 'spider' ? 'SPIDER' : 'POLICE',
    street: street.trim() || 'Rruga e zgjedhur',
    zone: zone.trim() || 'Zona e zgjedhur',
    latitude: coordinate?.lat ?? null,
    longitude: coordinate?.lng ?? null,
  }).select('id, kind, street, zone, created_at, expires_at').single()
  if (error) throw error
  return asAlert(data)
}
