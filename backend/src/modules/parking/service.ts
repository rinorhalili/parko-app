import type { ParkingStatus, ParkingType, Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { notFound } from "../../utils/errors.js";

export type NearbyQuery = {
  lat: number;
  lng: number;
  radius: number;
  status?: ParkingStatus;
  zone?: string;
  type?: ParkingType;
};

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const earth = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earth * Math.asin(Math.sqrt(h));
}

export async function nearbyParking(query: NearbyQuery) {
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    title: string;
    latitude: number;
    longitude: number;
    address: string | null;
    zone: string | null;
    status: ParkingStatus;
    type: ParkingType;
    distance: number;
    updatedAt: Date;
  }>>`
    SELECT id, title, latitude, longitude, address, zone, status, type, "updatedAt",
      ST_Distance("geoPoint", ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography) AS distance
    FROM "ParkingSpot"
    WHERE "geoPoint" IS NOT NULL
      AND ST_DWithin("geoPoint", ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography, ${query.radius})
      AND (${query.status ?? null}::"ParkingStatus" IS NULL OR status = ${query.status ?? null}::"ParkingStatus")
      AND (${query.zone ?? null}::text IS NULL OR zone = ${query.zone ?? null})
      AND (${query.type ?? null}::"ParkingType" IS NULL OR type = ${query.type ?? null}::"ParkingType")
    ORDER BY distance ASC
    LIMIT 100
  `;
  return rows;
}

export async function listParking() {
  return prisma.parkingSpot.findMany({ orderBy: { updatedAt: "desc" }, take: 100 });
}

export async function createParking(ownerId: string, input: Omit<Prisma.ParkingSpotUncheckedCreateInput, "ownerId" | "geoPoint">) {
  const spot = await prisma.parkingSpot.create({ data: { ...input, ownerId } });
  await prisma.$executeRaw`
    UPDATE "ParkingSpot"
    SET "geoPoint" = ST_SetSRID(ST_MakePoint(${spot.longitude}, ${spot.latitude}), 4326)::geography
    WHERE id = ${spot.id}
  `;
  return prisma.parkingSpot.findUniqueOrThrow({ where: { id: spot.id } });
}

export async function parkingById(id: string) {
  const spot = await prisma.parkingSpot.findUnique({ where: { id }, include: { reports: { orderBy: { createdAt: "desc" }, take: 10 } } });
  if (!spot) throw notFound("Parking spot not found");
  return spot;
}
