import type { DrivingRoute, Parking } from './types'

function distanceSquared(a: Parking['coordinates'], b: Parking['coordinates']) {
  return (a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2
}


export function kartaViewUrl(parking: Parking) {
  const target = parking.accessPoint ?? parking.coordinates
  return `https://kartaview.org/map/@${target.lat},${target.lng},18z`
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
