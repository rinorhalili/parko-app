export type Coordinate = { latitude: number; longitude: number };

const EARTH_RADIUS_METERS = 6_371_000;

function radians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceMeters(a: Coordinate, b: Coordinate) {
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export function isValidCoordinate(value: Coordinate) {
  return Number.isFinite(value.latitude) && Number.isFinite(value.longitude) && value.latitude >= -90 && value.latitude <= 90 && value.longitude >= -180 && value.longitude <= 180;
}
