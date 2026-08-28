import { PRISHTINA_DESTINATIONS } from './destinations'
import { PRISHTINA_MAP_BOUNDS, isWithinPrishtinaMap } from './parkingApi'
import type { Destination, DestinationCategory } from './types'

type NominatimResult = {
  place_id: number
  lat: string
  lon: string
  display_name: string
  name?: string
  type: string
  class: string
  address?: Record<string, string>
}

type NominatimReverseResult = Omit<NominatimResult, 'place_id' | 'lat' | 'lon' | 'type' | 'class'> & {
  place_id?: number
  lat: string
  lon: string
  type?: string
  class?: string
}

let lastOnlineRequest = 0

export function normalizeSearch(value: string) {
  return value
    .toLocaleLowerCase('sq')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .replace(/ë/g, 'e')
    .replace(/\b(rr|rruga|bulevardi|lagjja|sheshi)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function editDistance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = current
    }
  }
  return row[b.length]
}

export function searchLocalDestinations(query: string, limit = 7) {
  const normalized = normalizeSearch(query)
  if (!normalized) return PRISHTINA_DESTINATIONS.slice(0, limit)
  return PRISHTINA_DESTINATIONS
    .map((destination) => {
      const terms = [destination.name, destination.subtitle, ...destination.aliases].map(normalizeSearch)
      const best = Math.min(...terms.map((term) => {
        if (term === normalized) return 0
        if (term.startsWith(normalized)) return 1
        if (term.includes(normalized)) return 2
        const tokenMatch = normalized.split(' ').every((token) => term.includes(token))
        if (tokenMatch) return 3
        const distance = editDistance(normalized, term.slice(0, normalized.length))
        const tolerance = Math.max(1, Math.floor(normalized.length * .24))
        return distance <= tolerance ? 4 + distance / Math.max(1, normalized.length) : 10
      }))
      return { destination, score: best }
    })
    .filter(({ score }) => score < 5)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(({ destination }) => destination)
}

function categoryFor(result: NominatimResult): DestinationCategory {
  if (['road', 'street', 'residential'].includes(result.type)) return 'street'
  if (['suburb', 'neighbourhood', 'quarter', 'city_district'].includes(result.type)) return 'area'
  if (['building', 'house', 'commercial', 'retail'].includes(result.class) || result.class === 'amenity') return 'building'
  return 'place'
}

function fromNominatim(result: NominatimResult): Destination {
  const address = result.address ?? {}
  const name = result.name ?? address.amenity ?? address.road ?? result.display_name.split(',')[0]
  const subtitle = [address.road, address.suburb ?? address.neighbourhood, address.city].filter(Boolean).join(', ') || 'Prishtinë'
  return {
    id: `geo-${result.place_id}`,
    name,
    subtitle,
    category: categoryFor(result),
    coordinates: { lat: Number(result.lat), lng: Number(result.lon) },
    aliases: [result.display_name],
    source: 'geocoder',
  }
}

export async function searchDestinationOnline(query: string, signal?: AbortSignal) {
  const normalized = normalizeSearch(query)
  if (normalized.length < 2) return []
  const cacheKey = `parko-geocode:${normalized}`
  const cached = localStorage.getItem(cacheKey)
  if (cached) return JSON.parse(cached) as Destination[]

  const delay = Math.max(0, 1_050 - (Date.now() - lastOnlineRequest))
  if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay))
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  lastOnlineRequest = Date.now()

  const params = new URLSearchParams({
    q: `${query}, Prishtinë`,
    format: 'jsonv2',
    addressdetails: '1',
    namedetails: '1',
    limit: '8',
    viewbox: `${PRISHTINA_MAP_BOUNDS.west},${PRISHTINA_MAP_BOUNDS.north},${PRISHTINA_MAP_BOUNDS.east},${PRISHTINA_MAP_BOUNDS.south}`,
    bounded: '1',
    'accept-language': 'sq,en',
  })
  const response = await fetch(`/api/geocode?${params}`, { signal })
  if (!response.ok) throw new Error(`Geocoder returned ${response.status}`)
  const destinations = (await response.json() as NominatimResult[])
    .map(fromNominatim)
    .filter((destination) => isWithinPrishtinaMap(destination.coordinates))
  localStorage.setItem(cacheKey, JSON.stringify(destinations))
  return destinations
}

export async function reverseGeocodeLocation(coordinates: { lat: number; lng: number }, signal?: AbortSignal): Promise<Destination> {
  const params = new URLSearchParams({
    lat: String(coordinates.lat),
    lon: String(coordinates.lng),
    format: 'jsonv2',
    addressdetails: '1',
    zoom: '18',
    'accept-language': 'sq,en',
  })
  const response = await fetch(`/api/reverse?${params}`, { signal })
  if (!response.ok) throw new Error(`Reverse geocoder returned ${response.status}`)
  const result = await response.json() as NominatimReverseResult
  const address = result.address ?? {}
  const road = address.road ?? address.pedestrian ?? address.footway
  const area = address.neighbourhood ?? address.suburb ?? address.city_district
  const landmark = address.amenity ?? address.shop ?? address.tourism ?? address.building
  const name = landmark ?? road ?? area ?? 'Pika e zgjedhur'
  const subtitle = [road !== name ? road : undefined, area, address.city ?? 'Prishtinë'].filter(Boolean).join(', ')
  return {
    id: `map-${coordinates.lat.toFixed(5)}-${coordinates.lng.toFixed(5)}`,
    name,
    subtitle: subtitle || 'Prishtinë',
    category: landmark ? 'building' : road ? 'street' : area ? 'area' : 'place',
    coordinates,
    aliases: [result.display_name],
    source: 'map',
  }
}
