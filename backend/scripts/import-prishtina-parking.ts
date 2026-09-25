import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PrismaClient, type ParkingType } from "@prisma/client";

type SnapshotItem = [kind: "node" | "way" | "relation", id: number, lat: number, lng: number, tags: Record<string, string>];
type OfficialMarker = { markerId: string; code: string | null; title: string; address: string; lat: number; lng: number; capacity: number | null; pricePerHour: number | null; category: string };
type GoogleMarker = { markerId: string; title: string; address: string; lat: number; lng: number; pricePerHour: 0 | 1; type: "private" | "public"; covered: boolean };

const prisma = new PrismaClient();
const snapshotPath = fileURLToPath(new URL("../../src/osmParkingSnapshot.ts", import.meta.url));
const officialMarkersPath = fileURLToPath(new URL("../../src/officialPrishtinaParking.ts", import.meta.url));
const googleMarkersPath = fileURLToPath(new URL("../../src/verifiedGoogleParking.ts", import.meta.url));

function parseTypeScriptArray(source: string, marker: string): unknown[] {
  const match = source.match(new RegExp(`${marker}[^=]*= \\[([\\s\\S]*?)\\n\\]`));
  if (!match) throw new Error(`Could not read ${marker}.`);
  const json = `[${match[1]
    .replace(/,\\s*$/, "")
    .replace(/([{,]\\s*)([A-Za-z_$][\\w$]*)(\\s*:)/g, '$1"$2"$3')}]`;
  return JSON.parse(json) as unknown[];
}

function parkingType(tags: Record<string, string>): ParkingType {
  if (["private", "customers", "permit"].includes(tags.access?.toLowerCase())) return "PRIVATE";
  if (["multi-storey", "underground"].includes(tags.parking)) return "GARAGE";
  if (["street_side", "lane", "on_street"].includes(tags.parking)) return "STREET";
  return "LOT";
}

function capacity(tags: Record<string, string>) {
  const value = Number.parseInt(tags.capacity ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function loadSnapshot(): Promise<SnapshotItem[]> {
  const source = await readFile(snapshotPath, "utf8");
  return parseTypeScriptArray(source, "OSM_PARKING_SNAPSHOT") as SnapshotItem[];
}

async function loadOfficialMarkers(): Promise<OfficialMarker[]> {
  const source = await readFile(officialMarkersPath, "utf8");
  return parseTypeScriptArray(source, "OFFICIAL_PRISHTINA_PARKING_MARKERS") as OfficialMarker[];
}

async function loadGoogleMarkers(): Promise<GoogleMarker[]> {
  const source = await readFile(googleMarkersPath, "utf8");
  return parseTypeScriptArray(source, "VERIFIED_GOOGLE_PARKINGS") as GoogleMarker[];
}

async function main() {
  const [rows, officialMarkers, googleMarkers] = await Promise.all([loadSnapshot(), loadOfficialMarkers(), loadGoogleMarkers()]);
  let imported = 0;
  for (const [kind, osmId, latitude, longitude, tags] of rows) {
    const id = `osm-${kind}-${osmId}`;
    const zone = tags["addr:suburb"] ?? tags["addr:place"] ?? tags["is_in:suburb"] ?? "Prishtinë";
    const title = tags["name:sq"] ?? tags.name ?? `Parking ${zone}`;
    const address = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ") || `Prishtinë, Kosovë`;
    await prisma.parkingSpot.upsert({
      where: { id },
      create: { id, title, latitude, longitude, address, zone, type: parkingType(tags), capacity: capacity(tags), status: "UNKNOWN" },
      update: { title, latitude, longitude, address, zone, type: parkingType(tags), capacity: capacity(tags) }
    });
    await prisma.$executeRaw`
      UPDATE "ParkingSpot"
      SET "geoPoint" = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
      WHERE id = ${id}
    `;
    imported += 1;
  }
  for (const marker of officialMarkers) {
    const id = `prishtina-parking-${marker.markerId}`;
    await prisma.parkingSpot.upsert({
      where: { id },
      create: { id, title: marker.title, latitude: marker.lat, longitude: marker.lng, address: marker.address, zone: marker.code ? `Prishtina Parking ${marker.code}` : "Prishtina Parking", type: marker.category === "barrier" ? "GARAGE" : "STREET", capacity: marker.capacity, pricePerHour: marker.pricePerHour, status: "UNKNOWN" },
      update: { title: marker.title, latitude: marker.lat, longitude: marker.lng, address: marker.address, zone: marker.code ? `Prishtina Parking ${marker.code}` : "Prishtina Parking", type: marker.category === "barrier" ? "GARAGE" : "STREET", capacity: marker.capacity, pricePerHour: marker.pricePerHour }
    });
    await prisma.$executeRaw`
      UPDATE "ParkingSpot"
      SET "geoPoint" = ST_SetSRID(ST_MakePoint(${marker.lng}, ${marker.lat}), 4326)::geography
      WHERE id = ${id}
    `;
    imported += 1;
  }
  for (const marker of googleMarkers) {
    const id = `google-maps-${marker.markerId}`;
    const type: ParkingType = marker.type === "private" ? "PRIVATE" : marker.covered ? "GARAGE" : "LOT";
    await prisma.parkingSpot.upsert({
      where: { id },
      create: { id, title: marker.title, latitude: marker.lat, longitude: marker.lng, address: marker.address, zone: marker.type === "private" ? "Parking privat" : "Parking publik", type, pricePerHour: marker.pricePerHour, status: "UNKNOWN" },
      update: { title: marker.title, latitude: marker.lat, longitude: marker.lng, address: marker.address, zone: marker.type === "private" ? "Parking privat" : "Parking publik", type, pricePerHour: marker.pricePerHour }
    });
    await prisma.$executeRaw`
      UPDATE "ParkingSpot"
      SET "geoPoint" = ST_SetSRID(ST_MakePoint(${marker.lng}, ${marker.lat}), 4326)::geography
      WHERE id = ${id}
    `;
    imported += 1;
  }
  console.info(`Imported ${imported} Prishtina parking records.`);
}

main()
  .finally(async () => prisma.$disconnect());
