import { normalizeSearch } from "./geocodingApi";
import type { Destination, Parking } from "./types";

export function searchParkingDestinations(
  parkings: readonly Parking[],
  query: string,
  limit = 9,
): Destination[] {
  const normalized = normalizeSearch(query);
  if (normalized.length < 2 || limit <= 0) return [];

  const terms = normalized.split(" ");
  return parkings
    .filter((parking) => {
      const haystack = normalizeSearch(
        `${parking.name} ${parking.address} ${parking.zone} ${parking.operator ?? ""}`,
      );
      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, limit)
    .map((parking) => ({
      id: `parking-${parking.id}`,
      name: parking.name,
      subtitle: `${parking.address || parking.zone || "Prishtinë"} · Parking`,
      category: "place" as const,
      coordinates: parking.coordinates,
      aliases: [parking.name, parking.address, parking.zone],
      source: "map" as const,
    }));
}
