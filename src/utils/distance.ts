import type { MapCoordinate } from "../types";

const EARTH_RADIUS_METERS = 6_371_000;

function radians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceInMeters(a: MapCoordinate, b: MapCoordinate) {
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters?: number | null) {
  if (meters === undefined || meters === null || Number.isNaN(meters)) return "";
  if (meters < 1_000) return `${Math.round(meters)} m`;
  return `${(meters / 1_000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}
