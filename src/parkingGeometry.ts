import { distanceMeters } from './parkingRanking'
import type { MapCoordinate, Parking } from './types'

export function parkingAccessPoint(parking: Parking, toward: MapCoordinate): MapCoordinate {
  if (parking.accessPoint) return parking.accessPoint
  const boundary = parking.geometry?.flat() ?? []
  if (!boundary.length) return parking.coordinates
  return boundary.reduce((closest, point) => (
    distanceMeters(point, toward) < distanceMeters(closest, toward) ? point : closest
  ), boundary[0])
}

export function accessPointIsEstimated(parking: Parking) {
  return !parking.accessPoint && Boolean(parking.geometry?.length)
}
