import { describe, expect, it } from 'vitest'
import { mergeVerifiedAvailability } from './availabilityApi'
import { defaultParking } from './data'

describe('verified occupancy merge', () => {
  it('merges a fresh verified record', () => {
    const now = Date.parse('2026-08-26T12:10:00Z')
    const [parking] = mergeVerifiedAvailability([defaultParking], {
      source: 'Prishtina Parking',
      updatedAt: '2026-08-26T12:05:00Z',
      parkings: [{ id: defaultParking.id, spaces: 8, capacity: 100 }],
    }, now)
    expect(parking.spaces).toBe(8)
    expect(parking.status).toBe('limited')
    expect(parking.availabilitySource).toBe('Prishtina Parking')
  })

  it('rejects stale and negative occupancy', () => {
    const now = Date.parse('2026-08-26T13:00:00Z')
    const stale = mergeVerifiedAvailability([defaultParking], {
      source: 'operator', updatedAt: '2026-08-26T12:00:00Z', parkings: [{ id: defaultParking.id, spaces: 4 }],
    }, now)[0]
    const invalid = mergeVerifiedAvailability([defaultParking], {
      source: 'operator', updatedAt: '2026-08-26T12:59:00Z', parkings: [{ id: defaultParking.id, spaces: -1 }],
    }, now)[0]
    expect(stale.spaces).toBeNull()
    expect(invalid.spaces).toBeNull()
  })
})
