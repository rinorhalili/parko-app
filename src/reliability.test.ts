import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultParking } from './testFixtures'
import { mergeParkingSources } from './parkingApi'
import { walkableParkingCandidates } from './parkingRanking'
import { loadDrivingRoute } from './routingApi'
import { apiRequest, setAuthTokens } from './api/client'
import type { Destination } from './types'

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })

describe('parking data and radius', () => {
  it('preserves polygons and verified pricing when adding backend occupancy', () => {
    const mapped = { ...defaultParking, id: 'osm-way-1', geometry: [[{ lat: 42.66, lng: 21.16 }]], pricePerHour: 0.5, pricingSource: 'official-zone' as const }
    const backend = { ...mapped, geometry: undefined, pricePerHour: null, status: 'full' as const, spaces: null }
    const merged = mergeParkingSources([mapped], [backend, backend])
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ geometry: mapped.geometry, pricePerHour: 0.5, status: 'full', spaces: null })
  })
  it('keeps disabled parking restricted after merging', () => {
    const merged = mergeParkingSources([defaultParking], [{ ...defaultParking, access: 'no' }])
    expect(merged[0].access).toBe('no')
  })
  it('does not silently expand a walking radius or hide nearby point parking', () => {
    const destination: Destination = { id: 'destination', name: 'Dardani', subtitle: '', category: 'area', source: 'map', aliases: [], coordinates: { lat: 42.66, lng: 21.16 } }
    const near = { ...defaultParking, coordinates: destination.coordinates, geometry: undefined, access: 'public' as const }
    const far = { ...near, id: 'far', coordinates: { lat: 42.7, lng: 21.2 } }
    expect(walkableParkingCandidates([near, far], destination, 5).map((item) => item.parking.id)).toEqual([near.id])
    expect(walkableParkingCandidates([far], destination, 5)).toEqual([])
  })
})

describe('failure handling and credentials', () => {
  it('never fabricates a driving route when both routing services fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(loadDrivingRoute({ lat: 42.66, lng: 21.16 }, { lat: 42.67, lng: 21.17 })).rejects.toThrow('Rruga nuk u gjet')
  })
  it('does not persist a refresh token in browser storage', () => {
    setAuthTokens({ accessToken: 'access', refreshToken: 'legacy-refresh', user: {} as never })
    expect(localStorage.getItem('parko:refresh-token:v1')).toBeNull()
  })
  it('does not refresh a session after invalid login credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Invalid credentials' } }), { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(apiRequest('/auth/login', { method: 'POST' })).rejects.toThrow('Invalid credentials')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('returns a usable network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(apiRequest('/parking')).rejects.toThrow('Serveri nuk përgjigjet')
  })
})
