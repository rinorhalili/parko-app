import type { Availability, Parking } from './types'

export type AvailabilityEntry = {
  id?: string
  osmId?: string
  spaces: number
  capacity?: number
  status?: Availability
  updatedAt?: string
}

export type AvailabilityFeed = {
  source: string
  updatedAt: string
  parkings: AvailabilityEntry[]
}

function normalizedId(entry: AvailabilityEntry) {
  if (entry.id) return entry.id
  if (!entry.osmId) return ''
  const normalized = entry.osmId.replace(/^osm-/, '').replace('/', '-')
  return `osm-${normalized}`
}

function statusFor(entry: AvailabilityEntry): Availability {
  if (entry.status) return entry.status
  if (entry.spaces <= 0) return 'full'
  if (entry.capacity && entry.spaces / entry.capacity <= .12) return 'limited'
  return 'available'
}

export function mergeVerifiedAvailability(parkings: Parking[], feed: AvailabilityFeed, now = Date.now()) {
  const feedUpdated = Date.parse(feed.updatedAt)
  const entries = new Map(feed.parkings.map((entry) => [normalizedId(entry), entry]))
  return parkings.map((parking) => {
    const entry = entries.get(parking.id)
    if (!entry || !Number.isFinite(entry.spaces) || entry.spaces < 0) return parking
    const updatedAt = entry.updatedAt ?? feed.updatedAt
    const updatedTime = Date.parse(updatedAt)
    const ageMinutes = Math.max(0, Math.round((now - (Number.isFinite(updatedTime) ? updatedTime : feedUpdated)) / 60_000))
    if (!Number.isFinite(feedUpdated) || ageMinutes > 30) return parking
    return {
      ...parking,
      spaces: Math.round(entry.spaces),
      capacity: entry.capacity ?? parking.capacity,
      status: statusFor(entry),
      updatedMinutesAgo: ageMinutes,
      availabilitySource: feed.source,
      availabilityUpdatedAt: updatedAt,
      source: 'municipal' as const,
    }
  })
}

export async function loadVerifiedAvailability(signal?: AbortSignal): Promise<AvailabilityFeed | null> {
  const response = await fetch('/api/occupancy', { signal, headers: { Accept: 'application/json' } })
  if (response.status === 204 || response.status === 404) return null
  if (!response.ok) throw new Error(`Occupancy feed returned ${response.status}`)
  const payload = await response.json() as Partial<AvailabilityFeed>
  if (!payload.source || !payload.updatedAt || !Array.isArray(payload.parkings)) throw new Error('Invalid occupancy feed')
  return payload as AvailabilityFeed
}
