import { describe, expect, it } from 'vitest'
import { kartaViewUrl } from './streetView'
import type { Parking } from './types'

const parking = {
  id: 'test',
  name: 'Test Parking',
  coordinates: { lat: 42.66, lng: 21.16 },
} as Parking

describe('KartaView URL', () => {
  it('opens KartaView at the parking entrance without a Google redirect', () => {
    const url = new URL(kartaViewUrl({
      ...parking,
      accessPoint: { lat: 42.661, lng: 21.161 },
    }))

    expect(url.origin).toBe('https://kartaview.org')
    expect(url.pathname).toBe('/map/@42.661,21.161,18z')
    expect(url.href.includes('google.com')).toBe(false)
  })
})
