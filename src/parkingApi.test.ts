import { describe, expect, it } from 'vitest'
import { clampToPrishtinaMap, getPrishtinaParkingSnapshot, isWithinPrishtinaMap } from './parkingApi'

describe('Prishtina parking snapshot', () => {
  it('includes only the official Prishtina Parking map locations', () => {
    const parkings = getPrishtinaParkingSnapshot()

    expect(parkings).toHaveLength(90)
    expect(parkings.every((parking) => parking.source === 'municipal')).toBe(true)
    expect(parkings.every((parking) => parking.municipalManaged)).toBe(true)
    expect(parkings.every((parking) => parking.pricePerHour !== null)).toBe(true)
    expect(parkings.some((parking) => parking.municipalCode === 'X1' && parking.pricePerHour === 0.5)).toBe(true)
    expect(parkings.some((parking) => parking.municipalCode === 'K1' && parking.pricePerHour === 1)).toBe(true)
    expect(parkings.some((parking) => parking.municipalCode === 'K13' && parking.pricePerHour === 0.5)).toBe(true)
    expect(parkings.some((parking) => parking.municipalCode === 'X6' && parking.pricePerHour === 1)).toBe(true)
  })

  it('keeps interactive map coordinates inside Prishtina', () => {
    expect(isWithinPrishtinaMap({ lat: 42.6608, lng: 21.1608 })).toBe(true)
    expect(isWithinPrishtinaMap({ lat: 42.2139, lng: 20.7397 })).toBe(false)

    const clamped = clampToPrishtinaMap({ lat: 43, lng: 22 })
    expect(isWithinPrishtinaMap(clamped)).toBe(true)
    expect(clamped).toEqual({ lat: 42.7, lng: 21.225 })
  })
})
