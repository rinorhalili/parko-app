import type { DrivingRoute, Parking } from './types'

const KARTAVIEW_PHOTO_ENDPOINT = 'https://api.openstreetcam.org/2.0/photo/'
const KARTAVIEW_SEARCH_RADIUS_METERS = 1_000
const KARTAVIEW_MAX_DISTANCE_METERS = 1_200

type KartaViewPhotoResponse = {
  result?: {
    data?: unknown
  }
}

type KartaViewPhotoRecord = Record<string, unknown>

export type KartaViewPhoto = {
  id: string
  sequenceId: string
  sequenceIndex: number
  coordinates: Parking['coordinates']
  imageUrl: string
  capturedAt: string | null
  heading: number | null
}

export type KartaViewStreetView = {
  photos: KartaViewPhoto[]
  selectedPhotoIndex: number
}

function distanceSquared(a: Parking['coordinates'], b: Parking['coordinates']) {
  return (a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2
}

function coordinateDistanceMeters(first: Parking['coordinates'], second: Parking['coordinates']) {
  const earthRadius = 6_371_000
  const toRadians = (degrees: number) => degrees * Math.PI / 180
  const deltaLat = toRadians(second.lat - first.lat)
  const deltaLng = toRadians(second.lng - first.lng)
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(first.lat)) * Math.cos(toRadians(second.lat)) * Math.sin(deltaLng / 2) ** 2
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function parseKartaViewPhoto(value: unknown): KartaViewPhoto | null {
  if (!value || typeof value !== 'object') return null
  const record = value as KartaViewPhotoRecord
  const id = String(record.id ?? '')
  const sequenceId = String(record.sequenceId ?? '')
  const sequenceIndex = Number(record.sequenceIndex)
  const lat = Number(record.lat)
  const lng = Number(record.lng)
  const imageUrl = typeof record.imageProcUrl === 'string'
    ? record.imageProcUrl
    : typeof record.fileurlProc === 'string'
      ? record.fileurlProc
      : ''

  if (!id || !sequenceId || !Number.isFinite(sequenceIndex) || !Number.isFinite(lat) || !Number.isFinite(lng) || !imageUrl) return null
  return {
    id,
    sequenceId,
    sequenceIndex,
    coordinates: { lat, lng },
    imageUrl,
    capturedAt: typeof record.shotDate === 'string' ? record.shotDate : null,
    heading: Number.isFinite(Number(record.heading)) ? Number(record.heading) : null,
  }
}

async function requestKartaViewPhotos(params: URLSearchParams, signal?: AbortSignal) {
  const response = await fetch(`${KARTAVIEW_PHOTO_ENDPOINT}?${params.toString()}`, { signal })
  if (!response.ok) throw new Error(`KartaView request failed: ${response.status}`)
  const payload = await response.json() as KartaViewPhotoResponse
  return (Array.isArray(payload.result?.data) ? payload.result.data : [])
    .map(parseKartaViewPhoto)
    .filter((photo): photo is KartaViewPhoto => photo !== null)
}

export async function loadKartaViewStreetView(parking: Parking, signal?: AbortSignal): Promise<KartaViewStreetView | null> {
  const nearby = await requestKartaViewPhotos(new URLSearchParams({
    lat: parking.coordinates.lat.toFixed(6),
    lng: parking.coordinates.lng.toFixed(6),
    radius: String(KARTAVIEW_SEARCH_RADIUS_METERS),
    itemsPerPage: '50',
  }), signal)
  const closest = nearby
    .map((photo) => ({ photo, distance: coordinateDistanceMeters(parking.coordinates, photo.coordinates) }))
    .sort((first, second) => first.distance - second.distance)[0]

  if (!closest || closest.distance > KARTAVIEW_MAX_DISTANCE_METERS) return null

  try {
    const sequence = await requestKartaViewPhotos(new URLSearchParams({
      sequenceId: closest.photo.sequenceId,
      page: String(Math.floor(closest.photo.sequenceIndex / 150) + 1),
      itemsPerPage: '150',
    }), signal)
    const selectedPhotoIndex = sequence.findIndex((photo) => photo.id === closest.photo.id)
    if (sequence.length && selectedPhotoIndex >= 0) return { photos: sequence, selectedPhotoIndex }
  } catch {
    // The nearest photo is still useful if loading the rest of its sequence fails.
  }

  return { photos: [closest.photo], selectedPhotoIndex: 0 }
}

export function walkingDirectionsUrl(parking: Parking, destination: { coordinates: Parking['coordinates'] }) {
  const origin = parking.geometry?.flat().reduce((closest, point) => (
    distanceSquared(point, destination.coordinates) < distanceSquared(closest, destination.coordinates) ? point : closest
  ), parking.accessPoint ?? parking.coordinates) ?? parking.accessPoint ?? parking.coordinates
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.coordinates.lat},${destination.coordinates.lng}`,
    travelmode: 'walking',
  })
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function findCarDirectionsUrl(parking: Parking, parkedAt = parking.coordinates) {
  const params = new URLSearchParams({
    api: '1',
    destination: `${parkedAt.lat},${parkedAt.lng}`,
    travelmode: 'walking',
  })
  return `https://www.google.com/maps/dir/?${params.toString()}`
}
