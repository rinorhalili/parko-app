import { describe, expect, it } from 'vitest'
import { defaultParking } from './data'
import { walkableParkingCandidates } from './parkingRanking'
import type { Destination } from './types'

describe('parking radius results', () => {
  it('keeps every parking inside the selected walking radius', () => {
    const destination: Destination = {
      id: 'test-zone', name: 'Test', subtitle: 'Prishtinë', category: 'area', aliases: [], source: 'local',
      coordinates: { lat: 42.66, lng: 21.16 },
    }
    const parkings = Array.from({ length: 30 }, (_, index) => ({
      ...defaultParking,
      id: `parking-${index}`,
      coordinates: { lat: 42.66 + index * .00001, lng: 21.16 },
      geometry: [[{ lat: 42.66, lng: 21.16 }, { lat: 42.66001, lng: 21.16 }, { lat: 42.66, lng: 21.16001 }]],
    }))
    expect(walkableParkingCandidates(parkings, destination, 10)).toHaveLength(30)
  })
})
