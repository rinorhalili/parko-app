import { describe, expect, it } from 'vitest'
import { clampToPrishtinaMap, getPrishtinaParkingSnapshot, isWithinPrishtinaMap } from './parkingApi'

describe('Prishtina parking snapshot', () => {
  it('includes the official Prishtina Parking map locations', () => {
    const parkings = getPrishtinaParkingSnapshot()
    const officialParkings = parkings.filter((parking) => parking.source === 'municipal' && parking.municipalManaged)

    expect(officialParkings).toHaveLength(90)
    expect(officialParkings.some((parking) => parking.municipalCode === 'X1')).toBe(true)
    expect(officialParkings.some((parking) => parking.municipalCode === 'K13')).toBe(true)
  })

  it('keeps interactive map coordinates inside Prishtina', () => {
    expect(isWithinPrishtinaMap({ lat: 42.6608, lng: 21.1608 })).toBe(true)
    expect(isWithinPrishtinaMap({ lat: 42.2139, lng: 20.7397 })).toBe(false)

    const clamped = clampToPrishtinaMap({ lat: 43, lng: 22 })
    expect(isWithinPrishtinaMap(clamped)).toBe(true)
    expect(clamped).toEqual({ lat: 42.7, lng: 21.225 })
  })
})
