import type { ParkingStatus, ParkingType, Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { notFound } from "../../utils/errors.js";
import { effectiveStatus, publicParkingWhere } from './policy.js';
import { parkingRepository } from "../../repositories/parking.repository.js";

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
    reportedAt: Date | null;
  }>>`
    SELECT id, title, latitude, longitude, address, zone, status, type, "updatedAt", "reportedAt",
      ST_Distance("geoPoint", ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography) AS distance
    FROM "ParkingSpot"
    WHERE "geoPoint" IS NOT NULL
      AND ST_DWithin("geoPoint", ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography, ${query.radius})
      AND ("ownerId" IS NULL OR "verifiedAt" IS NOT NULL)
      AND status NOT IN ('TEMPORARILY_UNAVAILABLE', 'RESERVED')
      AND (${query.status ?? null}::"ParkingStatus" IS NULL OR
        (CASE WHEN status IN ('AVAILABLE', 'OCCUPIED') AND ("reportedAt" IS NULL OR "reportedAt" <= NOW() - INTERVAL '30 minutes') THEN 'UNKNOWN'::"ParkingStatus" ELSE status END) = ${query.status ?? null}::"ParkingStatus")
      AND (${query.zone ?? null}::text IS NULL OR zone = ${query.zone ?? null})
      AND (${query.type ?? null}::"ParkingType" IS NULL OR type = ${query.type ?? null}::"ParkingType")
    ORDER BY distance ASC
    LIMIT 100
  `;
  return rows.map((row) => effectiveStatus(row));
}

export async function listParking(page = 0) {
  const spots = await parkingRepository.listPublic(page, 200);
  return spots.map((spot) => effectiveStatus(spot));
}

export async function createParking(ownerId: string, input: Omit<Prisma.ParkingSpotUncheckedCreateInput, "ownerId" | "geoPoint">) {
  const spot = await parkingRepository.create({ ...input, ownerId });
  return prisma.parkingSpot.findUniqueOrThrow({ where: { id: spot.id } });
}

export async function parkingById(id: string) {
  const spot = await parkingRepository.findPublic(id);
  if (!spot) throw notFound("Parking spot not found");
  return effectiveStatus(spot);
}
