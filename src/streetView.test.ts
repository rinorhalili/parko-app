import { describe, expect, it } from 'vitest'
import { googleStreetViewUrl } from './streetView'
import type { Parking } from './types'

const parking = {
  id: 'test',
  name: 'Test Parking',
  coordinates: { lat: 42.66, lng: 21.16 },
} as Parking

describe('Google Street View URL', () => {
  it('opens Google Street View at the parking entrance without an API key', () => {
    const url = new URL(googleStreetViewUrl({
      ...parking,
      accessPoint: { lat: 42.661, lng: 21.161 },
    }))

    expect(url.searchParams.get('api')).toBe('1')
    expect(url.searchParams.get('map_action')).toBe('pano')
    expect(url.searchParams.get('viewpoint')).toBe('42.661,21.161')
    expect(url.searchParams.has('key')).toBe(false)
  })
})
