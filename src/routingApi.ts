import type { DrivingRoute, Parking, RouteStep } from './types'

type Coordinate = Parking['coordinates']

type OsrmStep = {
  distance: number
  name: string
  maneuver: { type: string; modifier?: string }
}

type OsrmResponse = {
  code: string
  routes?: Array<{
    distance: number
    duration: number
    geometry: { coordinates: Array<[number, number]> }
    legs: Array<{ steps: OsrmStep[] }>
  }>
}

type OsrmTableResponse = {
  code: string
  durations?: Array<Array<number | null>>
  distances?: Array<Array<number | null>>
}

type ValhallaResponse = {
  trip?: {
    summary: { length: number; time: number }
    legs: Array<{
      shape: string
      maneuvers?: Array<{ instruction?: string; verbal_pre_transition_instruction?: string; length?: number; type?: number }>
    }>
  }
}

export type DrivingMatrixEntry = {
  parkingId: string
  durationSeconds: number
  distanceMeters: number
}

function instructionFor(step: OsrmStep) {
  const modifier = step.maneuver.modifier
  if (step.maneuver.type === 'arrive') return 'Arrit në parking'
  if (step.maneuver.type === 'depart') return 'Nisu drejt parkingut'
  if (step.maneuver.type === 'roundabout' || step.maneuver.type === 'rotary') return 'Hyr në rrethrrotullim'
  if (step.maneuver.type === 'merge') return 'Bashkohu me rrugën'
  if (modifier === 'right' || modifier === 'slight right' || modifier === 'sharp right') return 'Kthehu djathtas'
  if (modifier === 'left' || modifier === 'slight left' || modifier === 'sharp left') return 'Kthehu majtas'
  if (modifier === 'uturn') return 'Bëj një kthesë U'
  return 'Vazhdo drejt'
}

function toRouteStep(step: OsrmStep): RouteStep {
  return {
    instruction: instructionFor(step),
    roadName: step.name || 'rruga pa emër',
    distanceMeters: Math.round(step.distance),
    maneuverType: step.maneuver.type,
  }
}

function straightLineDistance(start: Coordinate, end: Coordinate) {
  const radius = 6_371_000
  const p1 = start.lat * Math.PI / 180
  const p2 = end.lat * Math.PI / 180
  const dp = (end.lat - start.lat) * Math.PI / 180
  const dl = (end.lng - start.lng) * Math.PI / 180
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function fallbackRoute(start: Coordinate, end: Coordinate): DrivingRoute {
  const distance = Math.round(straightLineDistance(start, end) * 1.35)
  return {
    coordinates: [
      start,
      { lat: start.lat, lng: (start.lng + end.lng) / 2 },
      { lat: end.lat, lng: (start.lng + end.lng) / 2 },
      end,
    ],
    distanceMeters: distance,
    durationSeconds: Math.max(120, Math.round(distance / 7.5)),
    steps: [{ instruction: 'Vazhdo drejt parkingut', roadName: 'Rruga më e afërt', distanceMeters: distance, maneuverType: 'continue' }],
    source: 'fallback',
  }
}

function decodePolyline6(encoded: string) {
  const coordinates: Coordinate[] = []
  let index = 0
  let lat = 0
  let lng = 0
  while (index < encoded.length) {
    const values: number[] = []
    for (let coordinate = 0; coordinate < 2; coordinate += 1) {
      let result = 0
      let shift = 0
      let byte: number
      do {
        byte = encoded.charCodeAt(index++) - 63
        result |= (byte & 0x1f) << shift
        shift += 5
      } while (byte >= 0x20 && index <= encoded.length)
      values.push((result & 1) ? ~(result >> 1) : (result >> 1))
    }
    lat += values[0]
    lng += values[1]
    coordinates.push({ lat: lat / 1e6, lng: lng / 1e6 })
  }
  return coordinates
}

function walkingFallback(start: Coordinate, end: Coordinate): DrivingRoute {
  const distance = Math.round(straightLineDistance(start, end) * 1.22)
  return {
    coordinates: [start, end],
    distanceMeters: distance,
    durationSeconds: Math.max(60, Math.round(distance / 1.3)),
    steps: [{ instruction: 'Ec drejt destinacionit', roadName: 'Lidhje e përafërt', distanceMeters: distance, maneuverType: 'walk' }],
    source: 'estimated-walking',
  }
}

export async function loadWalkingRoute(start: Coordinate, end: Coordinate, signal?: AbortSignal): Promise<DrivingRoute> {
  const timeoutController = new AbortController()
  const timeout = window.setTimeout(() => timeoutController.abort(), 10_000)
  const forwardAbort = () => timeoutController.abort()
  signal?.addEventListener('abort', forwardAbort, { once: true })
  try {
    const response = await fetch('/api/walking-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locations: [{ lat: start.lat, lon: start.lng }, { lat: end.lat, lon: end.lng }],
        costing: 'pedestrian',
        units: 'kilometers',
        language: 'sq-AL',
      }),
      signal: timeoutController.signal,
    })
    if (!response.ok) return walkingFallback(start, end)
    const payload = await response.json() as ValhallaResponse
    const trip = payload.trip
    const leg = trip?.legs?.[0]
    if (!trip || !leg?.shape) return walkingFallback(start, end)
    return {
      coordinates: decodePolyline6(leg.shape),
      distanceMeters: Math.round(trip.summary.length * 1000),
      durationSeconds: Math.round(trip.summary.time),
      steps: (leg.maneuvers ?? []).map((maneuver) => ({
        instruction: maneuver.verbal_pre_transition_instruction ?? maneuver.instruction ?? 'Vazhdo',
        roadName: 'Rrugë këmbësorësh',
        distanceMeters: Math.round((maneuver.length ?? 0) * 1000),
        maneuverType: String(maneuver.type ?? 'walk'),
      })),
      source: 'valhalla',
    }
  } catch (error) {
    if (signal?.aborted) throw error
    return walkingFallback(start, end)
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', forwardAbort)
  }
}

export async function loadDrivingRoute(start: Coordinate, end: Coordinate, signal?: AbortSignal): Promise<DrivingRoute> {
  const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`
  const query = '?alternatives=false&steps=true&overview=full&geometries=geojson'
  const endpoints = [
    `/api/route/${coordinates}${query}`,
    `https://router.project-osrm.org/route/v1/driving/${coordinates}${query}`,
  ]

  for (const endpoint of endpoints) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const timeoutController = new AbortController()
    const forwardAbort = () => timeoutController.abort()
    signal?.addEventListener('abort', forwardAbort, { once: true })
    const timeout = window.setTimeout(() => timeoutController.abort(), 10_000)
    try {
      const response = await fetch(endpoint, { signal: timeoutController.signal })
      if (!response.ok) continue
      const payload = await response.json() as OsrmResponse
      const route = payload.routes?.[0]
      if (payload.code !== 'Ok' || !route) continue
      return {
        coordinates: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
        distanceMeters: Math.round(route.distance),
        durationSeconds: Math.round(route.duration),
        steps: route.legs.flatMap((leg) => leg.steps.map(toRouteStep)),
        source: 'osrm',
      }
    } catch (error) {
      if (signal?.aborted) throw error
    } finally {
      window.clearTimeout(timeout)
      signal?.removeEventListener('abort', forwardAbort)
    }
  }

  return fallbackRoute(start, end)
}

export async function loadDrivingMatrix(start: Coordinate, parkings: Parking[], signal?: AbortSignal): Promise<DrivingMatrixEntry[]> {
  if (!parkings.length) return []
  const candidates = parkings.slice(0, 25)
  const coordinates = [start, ...candidates.map((parking) => parking.coordinates)]
    .map(({ lng, lat }) => `${lng},${lat}`)
    .join(';')
  const destinationIndexes = candidates.map((_, index) => index + 1).join(';')
  const query = `?sources=0&destinations=${destinationIndexes}&annotations=duration,distance`
  const endpoints = [
    `/api/table/${coordinates}${query}`,
    `https://router.project-osrm.org/table/v1/driving/${coordinates}${query}`,
  ]

  for (const endpoint of endpoints) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      const response = await fetch(endpoint, { signal })
      if (!response.ok) continue
      const payload = await response.json() as OsrmTableResponse
      if (payload.code !== 'Ok' || !payload.durations?.[0]) continue
      return candidates.map((parking, index) => ({
        parkingId: parking.id,
        durationSeconds: payload.durations?.[0]?.[index] ?? parking.driveMinutes * 60,
        distanceMeters: payload.distances?.[0]?.[index] ?? parking.distanceMeters,
      }))
    } catch (error) {
      if (signal?.aborted) throw error
    }
  }

  return candidates.map((parking) => ({
    parkingId: parking.id,
    durationSeconds: parking.driveMinutes * 60,
    distanceMeters: parking.distanceMeters,
  }))
}
