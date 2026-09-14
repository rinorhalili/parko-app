import { prisma } from "../database/prisma.js";
import { favoritesService } from "../services/favorites.service.js";

export async function sendZoneAlertsJob() {
  const recentReports = await prisma.parkingReport.findMany({
    where: {
      status: "AVAILABLE",
      expiresAt: { gt: new Date() },
      createdAt: { gt: new Date(Date.now() - 10 * 60_000) },
    },
    include: { parkingSpot: { select: { id: true, title: true, zone: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  let delivered = 0;
  for (const report of recentReports) {
    delivered += await favoritesService.notifyZoneAvailability(report.reporterId, report.parkingSpot.zone, report.parkingSpot);
  }
  return { delivered };
}
