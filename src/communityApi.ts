import { getAccessToken } from './api/client'
import { createParkingReport, listParkingReports } from './api/reportService'
import type { Parking } from './types'

export type CommunityAvailability = 'AVAILABLE' | 'OCCUPIED'
export type CommunityReportStatus = CommunityAvailability | 'UNKNOWN'

export type CommunityParkingReport = {
  id: string
  parkingId: string
  status: CommunityReportStatus
  availability?: 'free-spots' | 'full'
  payment?: 'free' | 'paid'
  policeRisk?: boolean
  media?: Array<{ url: string; type: 'image' }>
  createdAt: number
  updatedAt: number
  expiresAt: number
}

type ApiReport = {
  id: string
  parkingSpotId: string
  status: CommunityReportStatus
  payment: 'FREE' | 'PAID' | null
  policeRisk: boolean | null
  media: Array<{ url: string; type: 'image' }> | null
  createdAt: string
  expiresAt: string
}

function asReport(row: ApiReport): CommunityParkingReport {
  return {
    id: row.id,
    parkingId: row.parkingSpotId,
    status: row.status,
    ...(row.status === 'AVAILABLE' ? { availability: 'free-spots' as const } : row.status === 'OCCUPIED' ? { availability: 'full' as const } : {}),
    ...(row.payment ? { payment: row.payment === 'FREE' ? 'free' as const : 'paid' as const } : {}),
    ...(row.policeRisk === null ? {} : { policeRisk: row.policeRisk }),
    ...(row.media?.length ? { media: row.media } : {}),
    createdAt: Date.parse(row.createdAt),
    updatedAt: Date.parse(row.createdAt),
    expiresAt: Date.parse(row.expiresAt),
  }
}

export async function loadCommunityState() {
  const { items } = await listParkingReports()
  const now = Date.now()
  return { reports: (items as ApiReport[]).filter((report) => Date.parse(report.expiresAt) > now).map(asReport) }
}

export type ParkingObservation = {
  availability?: CommunityAvailability
  payment?: 'free' | 'paid'
  policeRisk?: boolean
  description?: string
  media?: Array<{ url: string; type: 'image' }>
}

export async function submitParkingObservation(parking: Parking, observation: ParkingObservation) {
  if (!getAccessToken()) throw new Error('Ky veprim kërkon hyrje në llogari.')
  const report = await createParkingReport({
    parkingSpotId: parking.id,
    status: observation.availability ?? 'UNKNOWN',
    latitude: parking.coordinates.lat,
    longitude: parking.coordinates.lng,
    confidence: 60,
    description: observation.description,
    payment: observation.payment === 'free' ? 'FREE' : observation.payment === 'paid' ? 'PAID' : undefined,
    policeRisk: observation.policeRisk,
    media: observation.media,
  })
  return asReport(report as ApiReport)
}
