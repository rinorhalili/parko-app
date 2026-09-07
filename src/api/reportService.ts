import { apiRequest } from './client'
import type { CreateParkingReportInput, ParkingReport } from './types'

export function listParkingReports() { return apiRequest<ParkingReport[]>('/reports/parking') }

export function createParkingReport(input: CreateParkingReportInput) {
  return apiRequest<ParkingReport>('/reports/parking', { method: 'POST', body: JSON.stringify(input) })
}