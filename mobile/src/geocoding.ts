export type Destination = {
  id: string;
  name: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  source: "local" | "geocoder";
};

const PRISHTINA_BOUNDS = {
  south: 42.62,
  west: 21.115,
  north: 42.7,
  east: 21.225,
} as const;

const LOCAL_DESTINATIONS: Destination[] = [
  { id: "nene-tereza", name: "Sheshi Nene Tereza", subtitle: "Qender, Prishtine", latitude: 42.66291, longitude: 21.16551, source: "local" },
  { id: "zahir-pajaziti", name: "Sheshi Zahir Pajaziti", subtitle: "Qender, Prishtine", latitude: 42.66076, longitude: 21.16345, source: "local" },
  { id: "biblioteka", name: "Biblioteka Kombetare", subtitle: "Rr. Agim Ramadani", latitude: 42.65754, longitude: 21.16281, source: "local" },
  { id: "katedralja", name: "Katedralja Nene Tereza", subtitle: "Rr. Justiniani, Prishtine", latitude: 42.65766, longitude: 21.15939, source: "local" },
  { id: "qkuk", name: "QKUK", subtitle: "Qendra Klinike Universitare", latitude: 42.64891, longitude: 21.16482, source: "local" },
  { id: "albi-mall", name: "Albi Mall", subtitle: "Veternik, Prishtine", latitude: 42.62341, longitude: 21.15331, source: "local" },
  { id: "stacioni-autobuseve", name: "Stacioni i Autobuseve", subtitle: "Dardani, Prishtine", latitude: 42.64583, longitude: 21.15092, source: "local" },
  { id: "germia", name: "Parku i Germise", subtitle: "Germi, Prishtine", latitude: 42.67496, longitude: 21.20072, source: "local" },
  { id: "rruga-b", name: "Rruga B", subtitle: "Mati 1, Prishtine", latitude: 42.65563, longitude: 21.17618, source: "local" },
  { id: "dardania", name: "Dardania", subtitle: "Lagje, Prishtine", latitude: 42.65048, longitude: 21.15192, source: "local" },
  { id: "ulpiana", name: "Ulpiana", subtitle: "Lagje, Prishtine", latitude: 42.65186, longitude: 21.16518, source: "local" },
  { id: "bregu-diellit", name: "Bregu i Diellit", subtitle: "Lagje, Prishtine", latitude: 42.65694, longitude: 21.17921, source: "local" },
  { id: "arberia", name: "Arberia", subtitle: "Lagje, Prishtine", latitude: 42.65937, longitude: 21.14481, source: "local" },
  { id: "mati-1", name: "Mati 1", subtitle: "Lagje, Prishtine", latitude: 42.65385, longitude: 21.18142, source: "local" },
];

type NominatimResult = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  address?: Record<string, string>;
};

function normalizeSearch(value: string) {
  return value
    .toLocaleLowerCase("sq")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c")
    .replace(/ë/g, "e")
    .replace(/\b(rr|rruga|bulevardi|lagjja|sheshi)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function withinPrishtina(latitude: number, longitude: number) {
  return (
    latitude >= PRISHTINA_BOUNDS.south &&
    latitude <= PRISHTINA_BOUNDS.north &&
    longitude >= PRISHTINA_BOUNDS.west &&
    longitude <= PRISHTINA_BOUNDS.east
  );
}

function localMatches(query: string) {
  const normalized = normalizeSearch(query);
  if (!normalized) return LOCAL_DESTINATIONS.slice(0, 6);
  return LOCAL_DESTINATIONS.filter((destination) => {
    const haystack = normalizeSearch(`${destination.name} ${destination.subtitle}`);
    return normalized.split(" ").every((token) => haystack.includes(token));
  }).slice(0, 6);
}

function fromNominatim(result: NominatimResult): Destination | null {
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !withinPrishtina(latitude, longitude)) {
    return null;
  }
  const address = result.address ?? {};
  const name = result.name ?? address.amenity ?? address.road ?? result.display_name.split(",")[0] ?? "Lokacion";
  const subtitle = [address.road, address.neighbourhood ?? address.suburb, address.city ?? "Prishtine"].filter(Boolean).join(", ");
  return {
    id: `geo-${result.place_id}`,
    name,
    subtitle: subtitle || "Prishtine",
    latitude,
    longitude,
    source: "geocoder",
  };
}

export async function searchPrishtinaDestinations(query: string, signal?: AbortSignal): Promise<Destination[]> {
  const local = localMatches(query);
  const normalized = normalizeSearch(query);
  if (normalized.length < 2) return local;

  const params = new URLSearchParams({
    q: `${query}, Prishtine, Kosovo`,
    format: "jsonv2",
    addressdetails: "1",
    namedetails: "1",
    limit: "12",
    viewbox: `${PRISHTINA_BOUNDS.west},${PRISHTINA_BOUNDS.north},${PRISHTINA_BOUNDS.east},${PRISHTINA_BOUNDS.south}`,
    bounded: "1",
    "accept-language": "sq,en",
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { "User-Agent": "Parko/1.0 mobile geocoding" },
    signal,
  });
  if (!response.ok) return local;

  const online = ((await response.json()) as NominatimResult[]).map(fromNominatim).filter((item): item is Destination => item !== null);
  const seen = new Set<string>();
  return [...local, ...online].filter((destination) => {
    const key = `${normalizeSearch(destination.name)}:${destination.latitude.toFixed(4)}:${destination.longitude.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
}
