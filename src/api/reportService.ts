import { apiRequest } from './client'
import type { CreateParkingReportInput, ParkingReport } from './types'

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number }

export function listParkingReports(params: { page?: number; pageSize?: number; parkingSpotId?: string } = {}) {
  const query = new URLSearchParams()
  if (params.page !== undefined) query.set('page', String(params.page))
  if (params.pageSize !== undefined) query.set('pageSize', String(params.pageSize))
  if (params.parkingSpotId) query.set('parkingSpotId', params.parkingSpotId)
  const suffix = query.size ? `?${query}` : ''
  return apiRequest<Page<ParkingReport>>(`/reports/parking${suffix}`)
}

export function createParkingReport(input: CreateParkingReportInput) {
  return apiRequest<ParkingReport>('/reports/parking', { method: 'POST', body: JSON.stringify(input) })
}

export function voteOnParkingReport(id: string, vote: boolean) {
  return apiRequest<{ reportId: string; vote: boolean; confirmations: number; disagreements: number }>(`/reports/parking/${encodeURIComponent(id)}/vote`, { method: 'PUT', body: JSON.stringify({ vote }) })
}
