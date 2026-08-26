import { describe, expect, it } from 'vitest'
import { parkingAccessPoint } from './parkingGeometry'
import { defaultParking } from './data'

describe('parking access point', () => {
  it('prefers a verified entrance', () => {
    const accessPoint = { lat: 42.65, lng: 21.16 }
    expect(parkingAccessPoint({ ...defaultParking, accessPoint }, { lat: 42.7, lng: 21.2 })).toEqual(accessPoint)
  })

  it('uses the boundary vertex nearest the destination', () => {
    const parking = {
      ...defaultParking,
      geometry: [[
        { lat: 42.65, lng: 21.15 },
        { lat: 42.65, lng: 21.17 },
        { lat: 42.66, lng: 21.17 },
        { lat: 42.66, lng: 21.15 },
      ]],
    }
    expect(parkingAccessPoint(parking, { lat: 42.65, lng: 21.18 })).toEqual({ lat: 42.65, lng: 21.17 })
  })
})
