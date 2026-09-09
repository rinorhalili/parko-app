import type { ParkingStatus, Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { emitRealtime } from "../../websocket/io.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { recordEvent } from "../reputation/service.js";
import { publicParkingWhere } from '../parking/policy.js';

const NON_REPORTABLE_STATUSES: ParkingStatus[] = ['RESERVED', 'TEMPORARILY_UNAVAILABLE'];

export async function createParkingReport(reporterId: string, input: {
  parkingSpotId: string;
  status: "AVAILABLE" | "OCCUPIED" | "UNKNOWN";
  latitude: number;
  longitude: number;
  description?: string;
  confidence: number;
  payment?: "FREE" | "PAID";
  policeRisk?: boolean;
}) {
  const spot = await prisma.parkingSpot.findUnique({ where: { id: input.parkingSpotId } });
  if (!spot) throw notFound("Parking spot not found");
  if ((spot.ownerId && !spot.verifiedAt) || NON_REPORTABLE_STATUSES.includes(spot.status)) throw badRequest('This parking is not open for reports');

  const recent = await prisma.parkingReport.count({
    where: {
      reporterId,
      parkingSpotId: input.parkingSpotId,
      createdAt: { gte: new Date(Date.now() - 60_000) }
    }
  });
  if (recent > 0) throw badRequest("Please wait before reporting this spot again", "RATE_LIMITED");

  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.parkingReport.create({
      data: {
        reporterId,
        parkingSpotId: input.parkingSpotId,
        status: input.status as ParkingStatus,
        latitude: input.latitude,
        longitude: input.longitude,
        description: input.description,
        confidence: Math.min(input.confidence, 75),
        payment: input.payment,
        policeRisk: input.policeRisk,
        expiresAt: new Date(Date.now() + 30 * 60_000)
      }
    });
    await tx.$executeRaw`
      UPDATE "ParkingReport"
      SET "geoPoint" = ST_SetSRID(ST_MakePoint(${created.longitude}, ${created.latitude}), 4326)::geography
      WHERE id = ${created.id}
    `;
    if (input.status !== "UNKNOWN") {
      const updated = await tx.parkingSpot.updateMany({
        where: { id: input.parkingSpotId, ...publicParkingWhere, status: { notIn: NON_REPORTABLE_STATUSES } },
        data: { status: input.status as ParkingStatus, reportedAt: new Date() }
      });
      if (updated.count !== 1) throw badRequest('This parking is not open for reports');
    }
    return created;
  });

  await recordEvent({ userId: reporterId, score: 1, reason: "PARKING_REPORT_CREATED", parkingReportId: report.id });
  emitRealtime("parking:reported", report, 'community');
  emitRealtime("parking:updated", { parkingSpotId: input.parkingSpotId, status: input.status }, spot.zone ? `zone:${spot.zone}` : undefined);
  return report;
}

export async function listParkingReports({ page = 0, pageSize = 100, parkingSpotId }: { page?: number; pageSize?: number; parkingSpotId?: string } = {}) {
  const where: Prisma.ParkingReportWhereInput = {
    expiresAt: { gt: new Date() },
    ...(parkingSpotId ? { parkingSpotId } : {}),
    parkingSpot: { ...publicParkingWhere, status: { notIn: NON_REPORTABLE_STATUSES } }
  };
  const [items, total] = await Promise.all([
    prisma.parkingReport.findMany({ where, orderBy: { createdAt: "desc" }, take: pageSize, skip: page * pageSize, include: { reporter: { select: { id: true, username: true, reputationScore: true } } } }),
    prisma.parkingReport.count({ where })
  ]);
  return { items, total, page, pageSize };
}
