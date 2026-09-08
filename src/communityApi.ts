import { getAccessToken } from './api/client'
import { createParkingReport, listParkingReports } from './api/reportService'
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

function asReport(row: { id: string; parkingSpotId: string; status: string; createdAt: string; expiresAt: string }): CommunityParkingReport {
  const status: CommunityAvailability = row.status === 'AVAILABLE' ? 'AVAILABLE' : 'OCCUPIED'
  return { id: row.id, parkingId: row.parkingSpotId, status, createdAt: Date.parse(row.createdAt), expiresAt: Date.parse(row.expiresAt) }
}

export async function loadCommunityState() {
  const reports = await listParkingReports()
  const now = Date.now()
  return {
    reports: reports.filter((report) => Date.parse(report.expiresAt) > now).map(asReport),
    alerts: [],
  }
}

export async function submitParkingAvailability(parking: Parking, status: CommunityAvailability) {
  if (!getAccessToken()) throw new Error('Ky veprim kërkon hyrje në llogari.')
  return asReport(await createParkingReport({
    parkingSpotId: parking.id,
    status,
    latitude: parking.coordinates.lat,
    longitude: parking.coordinates.lng,
    confidence: 60,
  }))
}

export async function submitStreetAlert(_kind: CommunityStreetAlert['kind'], _street: string, _zone: string, _coordinate?: MapCoordinate) {
  throw new Error('Street alerts are not available in the new Parko service yet.')
}
