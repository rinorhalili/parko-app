import { afterEach, describe, expect, it, vi } from 'vitest'
import { fromPhoton, normalizeSearch, searchDestinationOnline, searchLocalDestinations } from './geocodingApi'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('destination search', () => {
  it('normalizes Albanian road prefixes and diacritics', () => {
    expect(normalizeSearch('Rruga Nëna Terezë')).toBe('nena tereze')
  })

  it('keeps Biblioteka results relevant', () => {
    const names = searchLocalDestinations('biblioteka').map((result) => result.name)
    expect(names).toContain('Biblioteka Kombëtare')
    expect(names.some((name) => /QKUK/i.test(name))).toBe(false)
  })

  it('converts Photon mall results into a Prishtina destination', () => {
    const destination = fromPhoton({
      geometry: { coordinates: [21.1775359, 42.6538466] },
      properties: {
        osm_type: 'W',
        osm_id: 602381503,
        osm_key: 'shop',
        type: 'house',
        name: 'Royal Mall',
        street: 'Rruga B',
        district: 'Bregu i Diellit',
        city: 'Pristina',
      },
    })

    expect(destination.name).toBe('Royal Mall')
    expect(destination.subtitle).toBe('Rruga B, Bregu i Diellit, Pristina')
    expect(destination.coordinates).toEqual({ lat: 42.6538466, lng: 21.1775359 })
    expect(destination.category).toBe('building')
  })

  it('falls back to Photon when the geocode proxy returns the app HTML', async () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now + 5_000)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.reject(new SyntaxError('Unexpected token <')) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          features: [{
            geometry: { coordinates: [21.1775359, 42.6538466] },
            properties: { osm_type: 'W', osm_id: 602381503, osm_key: 'shop', name: 'Royal Mall', street: 'Rruga B' },
          }],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const destinations = await searchDestinationOnline('Royal Mall')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toContain('photon.komoot.io/api/')
    expect(destinations[0].name).toBe('Royal Mall')
  })
})
