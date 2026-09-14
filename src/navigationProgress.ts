import { distanceMeters } from './parkingRanking'
import type { DrivingRoute, MapCoordinate } from './types'

// Project GPS onto the route instead of counting down while a driver is stopped.
// Off-route fixes keep the last route estimate until routing catches up.
export function remainingTrip(route: DrivingRoute, location: MapCoordinate) {
  let total = 0
  let travelled = 0
  let closest = Infinity
  const scaleX = Math.cos(location.lat * Math.PI / 180) * 111_320
  const scaleY = 111_320
  for (let index = 1; index < route.coordinates.length; index++) {
    const a = route.coordinates[index - 1]
    const b = route.coordinates[index]
    const ax = (a.lng - location.lng) * scaleX
    const ay = (a.lat - location.lat) * scaleY
    const dx = (b.lng - a.lng) * scaleX
    const dy = (b.lat - a.lat) * scaleY
    const squaredLength = dx * dx + dy * dy
    const fraction = squaredLength ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / squaredLength)) : 0
    const offset = Math.hypot(ax + fraction * dx, ay + fraction * dy)
    const length = distanceMeters(a, b)
    if (offset < closest) {
      closest = offset
      travelled = total + fraction * length
    }
    total += length
  }
  const fractionLeft = total > 0 && closest <= 60 ? Math.max(0, 1 - travelled / total) : 1
  return {
    distanceMeters: Math.max(0, route.distanceMeters * fractionLeft),
    durationSeconds: Math.max(0, route.durationSeconds * fractionLeft),
    offRoute: closest > 60,
  }
}

export function reliableArrival(location: MapCoordinate, target: MapCoordinate, accuracy: number | null, timestamp: number | null, now: number) {
  return timestamp !== null && now >= timestamp && now - timestamp <= 30_000 &&
    accuracy !== null && Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= 35 &&
    distanceMeters(location, target) <= 35
}
