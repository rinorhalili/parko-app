import type { DrivingRoute, Parking } from './types'

function distanceSquared(a: Parking['coordinates'], b: Parking['coordinates']) {
  return (a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2
}

function bearingDegrees(from: Parking['coordinates'], to: Parking['coordinates']) {
  const phi1 = from.lat * Math.PI / 180
  const phi2 = to.lat * Math.PI / 180
  const deltaLambda = (to.lng - from.lng) * Math.PI / 180
  const y = Math.sin(deltaLambda) * Math.cos(phi2)
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

export function streetViewUrl(parking: Parking, route?: DrivingRoute | null) {
  const params = new URLSearchParams({
    api: '1',
    map_action: 'pano',
    viewpoint: `${parking.coordinates.lat},${parking.coordinates.lng}`,
    pitch: '0',
    fov: '85',
  })

  const approachPoint = route?.coordinates
    .slice(0, -1)
    .reverse()
    .find((point) => distanceSquared(point, parking.coordinates) > 0.00000003)
  if (approachPoint) params.set('heading', bearingDegrees(approachPoint, parking.coordinates).toFixed(0))

  return `https://www.google.com/maps/@?${params.toString()}`
}

export function walkingDirectionsUrl(parking: Parking, destination: { coordinates: Parking['coordinates'] }) {
  const origin = parking.geometry?.flat().reduce((closest, point) => (
    distanceSquared(point, destination.coordinates) < distanceSquared(closest, destination.coordinates) ? point : closest
  ), parking.accessPoint ?? parking.coordinates) ?? parking.accessPoint ?? parking.coordinates
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.coordinates.lat},${destination.coordinates.lng}`,
    travelmode: 'walking',
  })
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function findCarDirectionsUrl(parking: Parking, parkedAt = parking.coordinates) {
  const params = new URLSearchParams({
    api: '1',
    destination: `${parkedAt.lat},${parkedAt.lng}`,
    travelmode: 'walking',
  })
  return `https://www.google.com/maps/dir/?${params.toString()}`
}
