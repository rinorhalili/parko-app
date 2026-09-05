import type { ParkingStatus } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { emitRealtime } from "../../websocket/io.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { recordEvent } from "../reputation/service.js";

export async function createParkingReport(reporterId: string, input: {
  parkingSpotId: string;
  status: "AVAILABLE" | "OCCUPIED" | "UNKNOWN";
  latitude: number;
  longitude: number;
  description?: string;
  confidence: number;
}) {
  const spot = await prisma.parkingSpot.findUnique({ where: { id: input.parkingSpotId } });
  if (!spot) throw notFound("Parking spot not found");

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
        confidence: input.confidence,
        expiresAt: new Date(Date.now() + 30 * 60_000)
      }
    });
    await tx.$executeRaw`
      UPDATE "ParkingReport"
      SET "geoPoint" = ST_SetSRID(ST_MakePoint(${created.longitude}, ${created.latitude}), 4326)::geography
      WHERE id = ${created.id}
    `;
    await tx.parkingSpot.update({
      where: { id: input.parkingSpotId },
      data: { status: input.status as ParkingStatus, reportedAt: new Date() }
    });
    return created;
  });

  await recordEvent({ userId: reporterId, score: 1, reason: "PARKING_REPORT_CREATED", parkingReportId: report.id });
  emitRealtime("parking:reported", report, `parking:${input.parkingSpotId}`);
  emitRealtime("parking:updated", { parkingSpotId: input.parkingSpotId, status: input.status }, spot.zone ? `zone:${spot.zone}` : undefined);
  return report;
}

export async function listParkingReports() {
  return prisma.parkingReport.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { parkingSpot: true, reporter: { select: { id: true, username: true, reputationScore: true } } } });
}
