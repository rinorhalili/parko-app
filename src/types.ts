export type Availability = 'available' | 'limited' | 'full' | 'unknown'
export type ParkingAccess = 'public' | 'permissive' | 'customers' | 'private' | 'permit' | 'no' | 'unknown'
export type MunicipalParkingCategory = 'residential' | 'commercial' | 'combined' | 'barrier'
export type MapCoordinate = { lat: number; lng: number }

export type Parking = {
  id: string
  name: string
  zone: string
  address: string
  capacity: number | null
  spaces: number | null
  status: Availability
  pricePerHour: number | null
  distanceMeters: number
  driveMinutes: number
  confidence: 'high' | 'medium' | 'low'
  updatedMinutesAgo: number
  type: 'public' | 'private' | 'street'
  open24h: boolean
  covered: boolean
  cardPayment: boolean
  evCharging: boolean
  accessible: boolean
  free: boolean
  coordinates: MapCoordinate
  geometry?: MapCoordinate[][]
  access: ParkingAccess
  osmUrl?: string
  source: 'openstreetmap' | 'municipal'
  availabilitySource?: string
  availabilityUpdatedAt?: string
  accessPoint?: MapCoordinate
  operator?: string | null
  openingHours?: string | null
  municipalManaged?: boolean
  municipalCode?: string | null
  municipalCategory?: MunicipalParkingCategory | null
  municipalZone?: 1 | 2 | 3 | null
  usageHours?: string | null
  pricingSource?: 'official-zone' | 'osm-sign' | null
}

export type ParkingLoadStatus = 'loading' | 'live' | 'fallback'

export type RouteStep = {
  instruction: string
  roadName: string
  distanceMeters: number
  maneuverType: string
}

export type DrivingRoute = {
  coordinates: Array<{ lat: number; lng: number }>
  distanceMeters: number
  durationSeconds: number
  steps: RouteStep[]
  source: 'osrm' | 'valhalla' | 'fallback' | 'walking' | 'estimated-walking'
}

export type ParkedSession = {
  parkingId: string
  parkedAt: MapCoordinate
  startedAt: number
  endsAt: number
  note: string
  reminderEnabled: boolean
}

export type DestinationCategory = 'building' | 'street' | 'area' | 'place'

export type Destination = {
  id: string
  name: string
  subtitle: string
  category: DestinationCategory
  coordinates: { lat: number; lng: number }
  aliases: string[]
  source: 'local' | 'geocoder' | 'map'
}

export type ParkingPreference = 'best' | 'closest' | 'cheapest' | 'chance'

export type RankedParking = {
  parking: Parking
  rank: number
  walkMinutes: number
  walkDistanceMeters: number
  driveMinutes: number
  driveDistanceMeters: number
  chancePercent: number
  score: number
}

export type Filters = {
  availableOnly: boolean
  verifiedOnly: boolean
  maxPrice: number
  type: 'all' | Parking['type']
  freeOnly: boolean
  evCharging: boolean
  accessible: boolean
}

export type Screen = 'home' | 'saved' | 'filters' | 'details' | 'navigation' | 'walking' | 'parked'
