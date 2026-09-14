import { prisma } from "../database/prisma.js";

export async function expireParkingReportsJob(now = new Date()) {
  const reports = await prisma.parkingReport.updateMany({
    where: { expiresAt: { lt: now }, confidence: { gt: 0 } },
    data: { confidence: 0 },
  });
  const parkings = await prisma.parkingSpot.updateMany({
    where: {
      status: { in: ["AVAILABLE", "OCCUPIED"] },
      OR: [{ reportedAt: null }, { reportedAt: { lte: new Date(now.getTime() - 30 * 60_000) } }],
    },
    data: { status: "UNKNOWN" },
  });
  return { reports: reports.count, parkings: parkings.count };
}
