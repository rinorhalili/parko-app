import { PARKINGS } from './data'
import { OSM_PARKING_SNAPSHOT } from './osmParkingSnapshot'
import { OFFICIAL_PRISHTINA_PARKING_MARKERS } from './officialPrishtinaParking'
import { deriveMunicipalParkingData } from './prishtinaParkingRules'
import { supabase, supabaseConfigError } from './lib/supabase'
import type { Parking, ParkingAccess } from './types'

const OVERPASS_URLS = [
  '/api/overpass',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
]
export const PRISHTINA_CENTER = { lat: 42.6608, lng: 21.1608 } as const
export const PRISHTINA_MAP_BOUNDS = {
  south: 42.620,
  west: 21.115,
  north: 42.700,
  east: 21.225,
} as const
const PRISHTINA_PARKING_BOUNDS = '42.625,21.115,42.690,21.215'
const USER_LOCATION = { lat: 42.6582, lng: 21.1585 }

export function isWithinPrishtinaMap(coordinates: Parking['coordinates']) {
  return coordinates.lat >= PRISHTINA_MAP_BOUNDS.south
    && coordinates.lat <= PRISHTINA_MAP_BOUNDS.north
    && coordinates.lng >= PRISHTINA_MAP_BOUNDS.west
    && coordinates.lng <= PRISHTINA_MAP_BOUNDS.east
}

export function clampToPrishtinaMap(coordinates: Parking['coordinates']) {
  return {
    lat: Math.min(PRISHTINA_MAP_BOUNDS.north, Math.max(PRISHTINA_MAP_BOUNDS.south, coordinates.lat)),
    lng: Math.min(PRISHTINA_MAP_BOUNDS.east, Math.max(PRISHTINA_MAP_BOUNDS.west, coordinates.lng)),
  }
}

type OsmElement = {
  id: number
  type: 'node' | 'way' | 'relation'
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  geometry?: Array<{ lat: number; lon: number }>
  members?: Array<{ role?: string; geometry?: Array<{ lat: number; lon: number }> }>
  tags?: Record<string, string>
}

type OverpassResponse = { elements?: OsmElement[] }

function distanceMeters(a: Parking['coordinates'], b: Parking['coordinates']) {
  const radius = 6_371_000
  const phi1 = a.lat * Math.PI / 180
  const phi2 = b.lat * Math.PI / 180
  const deltaPhi = (b.lat - a.lat) * Math.PI / 180
  const deltaLambda = (b.lng - a.lng) * Math.PI / 180
  const value = Math.sin(deltaPhi / 2) ** 2
    + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)))
}

function parsePrice(tags: Record<string, string>) {
  const fee = tags.fee?.toLowerCase()
  if (fee === 'no' || fee === 'free') return 0
  const charge = tags.charge ?? tags['charge:conditional'] ?? ''
  const normalized = charge.replace(',', '.')
  const match = normalized.match(/=\s*(\d+(?:\.\d+)?)/) ?? normalized.match(/(\d+(?:\.\d+)?)\s*€/)
  return match ? Number(match[1]) : null
}

function inferType(tags: Record<string, string>): Parking['type'] {
  if (['street_side', 'lane', 'on_street'].includes(tags.parking)) return 'street'
  if (['private', 'customers', 'permit'].includes(tags.access)) return 'private'
  return 'public'
}

function inferAccess(tags: Record<string, string>): ParkingAccess {
  const access = tags.access?.toLowerCase()
  if (access === 'yes') return 'public'
  if (access === 'permissive') return 'permissive'
  if (access === 'customers') return 'customers'
  if (access === 'private') return 'private'
  if (access === 'permit') return 'permit'
  if (access === 'no') return 'no'
  return 'unknown'
}

function elementGeometry(element: OsmElement) {
  const rings = element.geometry?.length
    ? [element.geometry]
    : (element.members ?? [])
      .filter((member) => !member.role || member.role === 'outer')
      .map((member) => member.geometry ?? [])

  return rings
    .filter((ring) => ring.length >= 3)
    .map((ring) => {
      const coordinates = ring.map(({ lat, lon }) => ({ lat, lng: lon }))
      const first = coordinates[0]
      const last = coordinates[coordinates.length - 1]
      if (first.lat !== last.lat || first.lng !== last.lng) coordinates.push(first)
      return coordinates
    })
}

function fromOsm(element: OsmElement): Parking | null {
  const geometry = elementGeometry(element)
  const geometryPoints = geometry.flat()
  const lat = element.lat ?? element.center?.lat ?? (geometryPoints.length ? geometryPoints.reduce((sum, point) => sum + point.lat, 0) / geometryPoints.length : undefined)
  const lng = element.lon ?? element.center?.lon ?? (geometryPoints.length ? geometryPoints.reduce((sum, point) => sum + point.lng, 0) / geometryPoints.length : undefined)
  if (lat === undefined || lng === undefined) return null

  const tags = element.tags ?? {}
  const capacityValue = Number.parseInt(tags.capacity ?? '', 10)
  const capacity = Number.isFinite(capacityValue) ? capacityValue : null
  const pricePerHour = parsePrice(tags)
  const municipal = deriveMunicipalParkingData(tags)
  const resolvedPrice = pricePerHour ?? municipal.officialVisitorPrice
  const distance = distanceMeters(USER_LOCATION, { lat, lng })
  const zone = tags['addr:suburb'] ?? tags['addr:place'] ?? tags['is_in:suburb'] ?? 'Prishtinë'
  const access = inferAccess(tags)
  const name = tags['name:sq'] ?? tags.name ?? `${access === 'public' || access === 'permissive' ? 'Parking publik' : 'Parking'} • ${zone}`
  const hasTrustTags = Boolean(tags.name || tags.operator || tags.capacity || tags.fee || tags.charge || tags.access)
  const confidence: Parking['confidence'] = geometry.length && hasTrustTags ? 'high' : hasTrustTags ? 'medium' : 'low'

  return {
    id: `osm-${element.type}-${element.id}`,
    name,
    zone,
    address: [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ') || (zone === 'Prishtinë' ? 'Prishtinë, Kosovë' : `${zone}, Prishtinë`),
    capacity,
    spaces: null,
    status: 'unknown',
    pricePerHour: resolvedPrice,
    distanceMeters: distance,
    driveMinutes: Math.max(2, Math.round(distance / 230)),
    confidence,
    updatedMinutesAgo: 0,
    type: inferType(tags),
    open24h: tags.opening_hours === '24/7',
    covered: tags.covered === 'yes' || tags.parking === 'multi-storey' || tags.parking === 'underground',
    cardPayment: tags['payment:credit_cards'] === 'yes' || tags['payment:debit_cards'] === 'yes',
    evCharging: tags.amenity === 'charging_station' || tags['charging_station'] === 'yes',
    accessible: ['yes', 'designated'].includes(tags.wheelchair),
    free: resolvedPrice === 0,
    coordinates: { lat, lng },
    geometry: geometry.length ? geometry : undefined,
    access,
    osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    source: 'openstreetmap',
    operator: municipal.operator,
    openingHours: tags.opening_hours ?? null,
    municipalManaged: municipal.municipalManaged,
    municipalCode: municipal.municipalCode,
    municipalCategory: municipal.municipalCategory,
    municipalZone: municipal.municipalZone,
    usageHours: tags.opening_hours ?? municipal.usageHours,
    pricingSource: pricePerHour !== null ? 'osm-sign' : municipal.officialVisitorPrice !== null ? 'official-zone' : null,
  }
}

function categoryLabel(category: NonNullable<Parking['municipalCategory']>) {
  if (category === 'barrier') return 'Parking me laure'
  if (category === 'commercial') return 'Parking komercial'
  if (category === 'combined') return 'Parking i kombinuar'
  return 'Parking rezidencial'
}

function fromOfficialPrishtinaParkingMarker(marker: (typeof OFFICIAL_PRISHTINA_PARKING_MARKERS)[number]): Parking {
  const municipal = deriveMunicipalParkingData({
    name: marker.title,
    operator: 'Prishtina Parking',
    ref: marker.code ?? '',
  })
  const coordinates = { lat: marker.lat, lng: marker.lng }
  const distance = distanceMeters(USER_LOCATION, coordinates)
  const pricePerHour = marker.pricePerHour ?? municipal.officialVisitorPrice

  return {
    id: `prishtina-parking-${marker.markerId}`,
    name: marker.title,
    zone: marker.code ? `Prishtina Parking ${marker.code}` : categoryLabel(marker.category),
    address: marker.address === 'Prishtinë' ? 'Prishtinë, Kosovë' : `${marker.address}, Prishtinë`,
    capacity: marker.capacity,
    spaces: null,
    status: 'unknown',
    pricePerHour,
    distanceMeters: distance,
    driveMinutes: Math.max(2, Math.round(distance / 230)),
    confidence: 'high',
    updatedMinutesAgo: 0,
    type: marker.category === 'commercial' || marker.category === 'barrier' ? 'public' : 'street',
    open24h: false,
    covered: false,
    cardPayment: marker.category === 'barrier',
    evCharging: false,
    accessible: false,
    free: pricePerHour === 0,
    coordinates,
    access: 'public',
    source: 'municipal',
    operator: 'Prishtina Parking',
    openingHours: null,
    municipalManaged: true,
    municipalCode: marker.code,
    municipalCategory: marker.category,
    municipalZone: municipal.municipalZone,
    usageHours: municipal.usageHours,
    pricingSource: marker.pricePerHour !== null || municipal.officialVisitorPrice !== null ? 'official-zone' : null,
  }
}

function withoutDuplicates(parkings: Parking[], existing: Parking[], thresholdMeters = 30) {
  return parkings.filter((parking) => (
    !existing.some((candidate) => parking.id === candidate.id || distanceMeters(parking.coordinates, candidate.coordinates) < thresholdMeters)
  ))
}

type ApprovedParkingSpot = {
  id: string
  title: string
  city: string
  address: string | null
  type: 'FREE' | 'PAID_PUBLIC' | 'PRIVATE' | 'STREET_RISKY'
  latitude: number
  longitude: number
  price_per_hour: number | null
  is_covered: boolean
}

async function loadApprovedParkingSpots(signal?: AbortSignal) {
  if (supabaseConfigError) return []
  const { data, error } = await supabase
    .from('parking_spots')
    .select('id, title, city, address, type, latitude, longitude, price_per_hour, is_covered')
    .eq('status', 'APPROVED')
    .abortSignal(signal ?? new AbortController().signal)
  if (error) throw error

  return (data as ApprovedParkingSpot[])
    .filter((spot) => spot.city.toLowerCase().includes('prisht'))
    .filter((spot) => isWithinPrishtinaMap({ lat: spot.latitude, lng: spot.longitude }))
    .map((spot): Parking => {
      const pricePerHour = spot.price_per_hour
      const type = spot.type === 'PRIVATE' ? 'private' : spot.type === 'STREET_RISKY' ? 'street' : 'public'
      return {
        id: `supabase-${spot.id}`,
        name: spot.title,
        zone: 'Prishtinë',
        address: spot.address ?? 'Prishtinë, Kosovë',
        capacity: null,
        spaces: null,
        status: 'unknown',
        pricePerHour,
        distanceMeters: distanceMeters(USER_LOCATION, { lat: spot.latitude, lng: spot.longitude }),
        driveMinutes: 0,
        confidence: 'high',
        updatedMinutesAgo: 0,
        type,
        open24h: false,
        covered: spot.is_covered,
        cardPayment: false,
        evCharging: false,
        accessible: false,
        free: spot.type === 'FREE' || pricePerHour === 0,
        coordinates: { lat: spot.latitude, lng: spot.longitude },
        access: type === 'private' ? 'private' : 'unknown',
        source: 'municipal',
        operator: 'Parko community',
      }
    })
}

export async function loadPrishtinaParkings(signal?: AbortSignal) {
  const query = `[out:json][timeout:30];nwr["amenity"="parking"](${PRISHTINA_PARKING_BOUNDS});out body center geom;`
  let payload: OverpassResponse | null = null
  let lastError: unknown = new Error('Overpass is unavailable')

  for (const endpoint of OVERPASS_URLS) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const timeoutController = new AbortController()
    const forwardAbort = () => timeoutController.abort()
    signal?.addEventListener('abort', forwardAbort, { once: true })
    const timeout = window.setTimeout(() => timeoutController.abort(), endpoint.startsWith('/') ? 35_000 : 15_000)
    try {
      const response = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
        signal: timeoutController.signal,
      })
      if (!response.ok) throw new Error(`Overpass returned ${response.status}`)
      payload = await response.json() as OverpassResponse
      break
    } catch (error) {
      lastError = error
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    } finally {
      window.clearTimeout(timeout)
      signal?.removeEventListener('abort', forwardAbort)
    }
  }

  if (!payload) throw lastError
  const osmParkings = (payload.elements ?? []).map(fromOsm).filter((parking): parking is Parking => parking !== null)
  if (!osmParkings.length) throw new Error('No parking data returned')
  let approvedParkings: Parking[] = []
  try {
    approvedParkings = await loadApprovedParkingSpots(signal)
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    console.warn('Approved Supabase parking spots could not be loaded; continuing with map data.', error)
  }
  const officialParkings = OFFICIAL_PRISHTINA_PARKING_MARKERS.map(fromOfficialPrishtinaParkingMarker)

  const enrichedSeeds = PARKINGS.map((seed) => {
    const liveMatch = osmParkings.find((parking) => parking.id === seed.id || distanceMeters(seed.coordinates, parking.coordinates) < 45)
    return liveMatch ? { ...seed, ...liveMatch, name: seed.name } : seed
  })
  const seedParkings = withoutDuplicates(enrichedSeeds, [...officialParkings, ...approvedParkings], 30)
  const osmWithoutDuplicates = withoutDuplicates(osmParkings, [...officialParkings, ...approvedParkings, ...seedParkings], 30)
  return [...officialParkings, ...approvedParkings, ...seedParkings, ...osmWithoutDuplicates].sort((a, b) => a.distanceMeters - b.distanceMeters)
}

type OsmApiElement = {
  id: number
  type: 'node' | 'way' | 'relation'
  lat?: number
  lon?: number
  nodes?: number[]
  members?: Array<{ type: string; ref: number; role?: string }>
  tags?: Record<string, string>
}

export async function loadParkingGeometry(parking: Parking, signal?: AbortSignal) {
  if (parking.geometry?.length && parking.accessPoint) return { geometry: parking.geometry, accessPoint: parking.accessPoint }
  const match = parking.id.match(/^osm-(node|way|relation)-(\d+)$/)
  if (!match || match[1] === 'node') return { geometry: parking.geometry, accessPoint: parking.accessPoint }
  const [, type, id] = match
  const response = await fetch(`/api/osm/${type}/${id}/full.json`, { signal })
  if (!response.ok) throw new Error(`OSM geometry returned ${response.status}`)
  const payload = await response.json() as { elements?: OsmApiElement[] }
  const elements = payload.elements ?? []
  const nodes = new Map(elements
    .filter((element) => element.type === 'node' && element.lat !== undefined && element.lon !== undefined)
    .map((element) => [element.id, { lat: element.lat!, lng: element.lon! }]))
  const ways = new Map(elements.filter((element) => element.type === 'way').map((element) => [element.id, element]))

  const wayIds = type === 'way'
    ? [Number(id)]
    : (elements.find((element) => element.type === 'relation' && element.id === Number(id))?.members ?? [])
      .filter((member) => member.type === 'way' && (!member.role || member.role === 'outer'))
      .map((member) => member.ref)

  const geometry = wayIds
    .map((wayId) => (ways.get(wayId)?.nodes ?? []).map((nodeId) => nodes.get(nodeId)).filter((point): point is NonNullable<typeof point> => Boolean(point)))
    .filter((ring) => ring.length >= 3)
    .map((ring) => {
      const closed = [...ring]
      const first = closed[0]
      const last = closed[closed.length - 1]
      if (first.lat !== last.lat || first.lng !== last.lng) closed.push(first)
      return closed
    })
  const entranceNodes = elements.filter((element) => (
    element.type === 'node'
    && element.lat !== undefined
    && element.lon !== undefined
    && (element.tags?.amenity === 'parking_entrance' || (element.tags?.entrance && element.tags.entrance !== 'no'))
  ))
  const accessPoint = entranceNodes
    .map((element) => ({ lat: element.lat!, lng: element.lon! }))
    .sort((a, b) => distanceMeters(parking.coordinates, a) - distanceMeters(parking.coordinates, b))[0]
  return { geometry: geometry.length ? geometry : parking.geometry, accessPoint: accessPoint ?? parking.accessPoint }
}

export function getPrishtinaParkingSnapshot() {
  const snapshotParkings = OSM_PARKING_SNAPSHOT
    .map(([type, id, lat, lng, tags]) => fromOsm({ type, id, lat, lon: lng, tags }))
    .filter((parking): parking is Parking => parking !== null)
  const officialParkings = OFFICIAL_PRISHTINA_PARKING_MARKERS.map(fromOfficialPrishtinaParkingMarker)
  const enrichedSeeds = PARKINGS.map((seed) => {
    const snapshotMatch = snapshotParkings.find((parking) => parking.id === seed.id || distanceMeters(seed.coordinates, parking.coordinates) < 45)
    return snapshotMatch ? { ...seed, ...snapshotMatch, name: seed.name } : seed
  })
  const seedParkings = withoutDuplicates(enrichedSeeds, officialParkings, 30)
  const snapshotWithoutDuplicates = withoutDuplicates(snapshotParkings, [...officialParkings, ...seedParkings], 30)
  return [...officialParkings, ...seedParkings, ...snapshotWithoutDuplicates].sort((a, b) => a.distanceMeters - b.distanceMeters)
}

export { USER_LOCATION }
