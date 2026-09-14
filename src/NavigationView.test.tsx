import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import NavigationView from './NavigationView'
import { defaultParking } from './testFixtures'
import type { DrivingRoute } from './types'
import { remainingTrip, reliableArrival } from './navigationProgress'

vi.mock('./LiveParkingMap', () => ({ default: () => <div data-testid="map">Map</div> }))
const start = { lat: 42.65, lng: 21.16 }
const end = defaultParking.coordinates
const route: DrivingRoute = { coordinates: [start, end], distanceMeters: 1100, durationSeconds: 600, source: 'osrm', steps: [] }
let root: Root
let host: HTMLDivElement
const stop = vi.fn()
const finish = vi.fn()
const props = { parking: defaultParking, route, routeLoading: false, routeError: '', userLocation: start, userLocationLive: true, userLocationAccuracy: 10, locationTimestamp: 1_800_000_000_000, mapSettings: { variant: 'standard' as const, parkingPalette: 'green' as const, emphasizeAreas: true, largePointMarkers: true, showPointParking: true, largeLabels: false, showDataSources: true }, recenterToken: 0, hasDestination: false, onRecenter: vi.fn(), onStop: stop, onArrive: finish }
async function render(overrides: Partial<Parameters<typeof NavigationView>[0]> = {}) {
  await act(async () => root.render(<NavigationView {...props} {...overrides} />))
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(props.locationTimestamp)
  stop.mockClear(); finish.mockClear()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers() })

it('reduces estimates with GPS progress, not elapsed time at a stop', async () => {
  await render()
  expect(host.querySelector('.trip-metrics')?.textContent).toContain('10 min')
  const eta = host.querySelectorAll('.trip-metrics strong')[1].textContent
  await act(async () => { vi.advanceTimersByTime(60_000) })
  await render({ locationTimestamp: Date.now() })
  expect(host.querySelector('.trip-metrics')?.textContent).toContain('10 min')
  expect(host.querySelectorAll('.trip-metrics strong')[1].textContent).not.toBe(eta)
  await render({ userLocation: { lat: 42.655, lng: 21.16 }, locationTimestamp: Date.now() })
  expect(host.querySelector('.trip-metrics')?.textContent).toContain('5 min')
})

it('requires fresh accurate distinct arrival fixes and keeps Arrived visible', async () => {
  await render({ userLocation: end, userLocationAccuracy: 150 })
  expect(host.querySelector('.navigation-screen--arrived')).toBeNull()
  await render({ userLocation: end })
  await act(async () => { vi.advanceTimersByTime(4000) })
  expect(host.querySelector('.navigation-screen--arrived')).toBeNull()
  await render({ userLocation: end, locationTimestamp: Date.now() })
  expect(host.textContent).toContain('Ke mbërritur në parking.')
  await render({ userLocation: start, userLocationLive: false })
  expect(host.querySelector('.navigation-screen--arrived')).not.toBeNull()
  expect(host.querySelector('[data-testid="map"]')).not.toBeNull()
  expect(finish).not.toHaveBeenCalled()
  await act(async () => (host.querySelector('.trip-finish') as HTMLButtonElement).click())
  expect(finish).toHaveBeenCalledOnce()
})

it('keeps navigation open on lost GPS or route failure and exits using X', async () => {
  await render()
  await render({ route: null, routeError: 'offline', userLocationLive: false })
  expect(host.textContent).toContain('Duke pritur sinjalin GPS')
  expect(host.textContent).toContain(defaultParking.name)
  expect(stop).not.toHaveBeenCalled()
  await act(async () => (host.querySelector('.trip-close') as HTMLButtonElement).click())
  expect(stop).toHaveBeenCalledOnce()
})

it('supports manual arrival before continuing on foot', async () => {
  await render({ hasDestination: true })
  await act(async () => (host.querySelector('.trip-arrive') as HTMLButtonElement).click())
  expect(host.textContent).toContain('Parkova · vazhdo në këmbë')
  expect(finish).not.toHaveBeenCalled()
})

it('rejects inaccurate, stale and distant arrival fixes', () => {
  expect(reliableArrival(end, end, 10, Date.now() - 31_000, Date.now())).toBe(false)
  expect(reliableArrival(end, end, null, Date.now(), Date.now())).toBe(false)
  expect(reliableArrival(start, end, 10, Date.now(), Date.now())).toBe(false)
})

it('keeps a full estimate off route and handles degenerate geometry', () => {
  expect(remainingTrip(route, { lat: 42.655, lng: 21.18 })).toMatchObject({ durationSeconds: 600, offRoute: true })
  expect(remainingTrip({ ...route, coordinates: [start, start] }, start).durationSeconds).toBe(600)
})
