import type { DrivingMatrixEntry } from './routingApi'
import type { Destination, Parking, ParkingPreference, RankedParking } from './types'

export function distanceMeters(a: Parking['coordinates'], b: Parking['coordinates']) {
  const radius = 6_371_000
  const p1 = a.lat * Math.PI / 180
  const p2 = b.lat * Math.PI / 180
  const dp = (b.lat - a.lat) * Math.PI / 180
  const dl = (b.lng - a.lng) * Math.PI / 180
  const value = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)))
}

function availabilityChance(parking: Parking) {
  const statusBase = { available: 72, limited: 46, full: 5, unknown: 31 }[parking.status]
  const spaceBoost = parking.spaces === null ? 0 : Math.min(15, Math.round(parking.spaces / 3))
  const confidenceBoost = { high: 8, medium: 2, low: -6 }[parking.confidence]
  const stalePenalty = Math.min(12, Math.floor(parking.updatedMinutesAgo / 4))
  return Math.max(3, Math.min(94, statusBase + spaceBoost + confidenceBoost - stalePenalty))
}

export function walkableParkingCandidates(parkings: Parking[], destination: Destination, walkLimitMinutes: number) {
  const safelyAccessible = parkings.filter((parking) => ['public', 'permissive', 'unknown'].includes(parking.access))
  const preciselyMappedAreas = safelyAccessible.filter((parking) => (
    parking.geometry?.length || /^osm-(way|relation)-/.test(parking.id)
  ))
  const reliableSource = preciselyMappedAreas.length >= 3 ? preciselyMappedAreas : safelyAccessible
  const all = reliableSource
    .map((parking) => {
      const directDistance = distanceMeters(parking.coordinates, destination.coordinates)
      const walkDistanceMeters = Math.round(directDistance * 1.22)
      const walkMinutes = Math.max(1, Math.ceil(walkDistanceMeters / 78))
      return { parking, walkDistanceMeters, walkMinutes }
    })
    .sort((a, b) => a.walkMinutes - b.walkMinutes)

  const inside = all.filter((candidate) => candidate.walkMinutes <= walkLimitMinutes)
  return inside.length >= 3 ? inside : all.slice(0, Math.max(3, inside.length))
}

export function rankParkings(
  candidates: ReturnType<typeof walkableParkingCandidates>,
  matrix: DrivingMatrixEntry[],
  preference: ParkingPreference,
): RankedParking[] {
  const matrixMap = new Map(matrix.map((entry) => [entry.parkingId, entry]))
  const enriched = candidates.map((candidate) => {
    const drive = matrixMap.get(candidate.parking.id)
    const driveMinutes = Math.max(1, Math.ceil((drive?.durationSeconds ?? candidate.parking.driveMinutes * 60) / 60))
    const driveDistanceMeters = Math.round(drive?.distanceMeters ?? candidate.parking.distanceMeters)
    const chancePercent = availabilityChance(candidate.parking)
    const pricePenalty = candidate.parking.pricePerHour === null ? 7 : candidate.parking.pricePerHour * 5
    const uncertaintyPenalty = candidate.parking.confidence === 'low' ? 4 : candidate.parking.confidence === 'medium' ? 1.5 : 0
    const accessPenalty = candidate.parking.access === 'unknown' ? 4 : 0
    const bestScore = driveMinutes * .25 + candidate.walkMinutes * .3 + pricePenalty * .2 + (100 - chancePercent) * .02 + uncertaintyPenalty * .05 + accessPenalty
    return { ...candidate, driveMinutes, driveDistanceMeters, chancePercent, score: bestScore }
  })

  enriched.sort((a, b) => {
    if (preference === 'closest') return a.walkMinutes - b.walkMinutes || a.driveMinutes - b.driveMinutes
    if (preference === 'cheapest') {
      const aPrice = a.parking.pricePerHour ?? 99
      const bPrice = b.parking.pricePerHour ?? 99
      return aPrice - bPrice || a.walkMinutes - b.walkMinutes
    }
    if (preference === 'chance') return b.chancePercent - a.chancePercent || a.walkMinutes - b.walkMinutes
    return a.score - b.score
  })

  return enriched.map((candidate, index) => ({ ...candidate, rank: index + 1 }))
}
