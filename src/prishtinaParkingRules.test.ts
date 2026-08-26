import { describe, expect, it } from 'vitest'
import { deriveMunicipalParkingData } from './prishtinaParkingRules'

describe('Prishtina Parking metadata', () => {
  it('uses the documented Zone 1 visitor rule only for an explicit A code', () => {
    const data = deriveMunicipalParkingData({ operator: 'Prishtina Parking', ref: 'A-12' })
    expect(data.municipalManaged).toBe(true)
    expect(data.municipalCode).toBe('A12')
    expect(data.municipalCategory).toBe('residential')
    expect(data.municipalZone).toBe(1)
    expect(data.officialVisitorPrice).toBe(1)
    expect(data.usageHours).toContain('07:00–18:00')
  })

  it('does not invent a numeric zone or tariff for a commercial code', () => {
    const data = deriveMunicipalParkingData({ operator: 'N.P. Prishtina Parking', ref: 'K7' })
    expect(data.municipalCategory).toBe('commercial')
    expect(data.municipalZone).toBeNull()
    expect(data.officialVisitorPrice).toBeNull()
  })

  it('does not attach municipal data to unrelated OSM parking', () => {
    const data = deriveMunicipalParkingData({ operator: 'Private Hotel', ref: 'A1' })
    expect(data.municipalManaged).toBe(false)
    expect(data.municipalCode).toBeNull()
    expect(data.municipalCategory).toBeNull()
    expect(data.usageHours).toBeNull()
  })

  it('leaves uncoded official entries honest and incomplete', () => {
    const data = deriveMunicipalParkingData({ operator: 'Prishtina Parking' })
    expect(data.municipalManaged).toBe(true)
    expect(data.municipalCode).toBeNull()
    expect(data.municipalZone).toBeNull()
    expect(data.officialVisitorPrice).toBeNull()
    expect(data.usageHours).toBeNull()
  })
})
