import { describe, expect, it, vi } from 'vitest'
import { loadKartaViewStreetView } from './streetView'
import type { Parking } from './types'

const parking = {
  id: 'test',
  name: 'Test Parking',
  coordinates: { lat: 42.66, lng: 21.16 },
} as Parking

describe('KartaView street-level imagery', () => {
  it('loads the closest usable photo and its sequence without an API key', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { data: [{ id: 'nearby', sequenceId: '42', sequenceIndex: '1', lat: 42.6601, lng: 21.1601, imageProcUrl: 'https://images.example/nearby.jpg' }] } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { data: [
        { id: 'before', sequenceId: '42', sequenceIndex: '0', lat: 42.6600, lng: 21.1600, imageProcUrl: 'https://images.example/before.jpg' },
        { id: 'nearby', sequenceId: '42', sequenceIndex: '1', lat: 42.6601, lng: 21.1601, imageProcUrl: 'https://images.example/nearby.jpg' },
      ] } })))
    vi.stubGlobal('fetch', fetchMock)

    const view = await loadKartaViewStreetView(parking)

    expect(view?.photos).toHaveLength(2)
    expect(view?.selectedPhotoIndex).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toContain('radius=1000')
  })

  it('reports no coverage when the closest photo is too far away', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: { data: [{ id: 'far', sequenceId: '1', sequenceIndex: '0', lat: 42.7, lng: 21.2, imageProcUrl: 'https://images.example/far.jpg' }] } }))))

    await expect(loadKartaViewStreetView(parking)).resolves.toBeNull()
  })
})
