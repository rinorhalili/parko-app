import { prisma } from "../../database/prisma.js";

export async function dashboardAnalytics() {
  const [
    users,
    parkingSpots,
    activeReports,
    activeReservations,
    posts,
    notifications,
  ] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.parkingSpot.count(),
    prisma.parkingReport.count({ where: { expiresAt: { gt: new Date() } } }),
    prisma.parkingReservation.count({ where: { cancelledAt: null, expiresAt: { gt: new Date() } } }),
    prisma.post.count({ where: { deletedAt: null } }),
    prisma.notification.count({ where: { readAt: null } }),
  ]);
  return { users, parkingSpots, activeReports, activeReservations, posts, unreadNotifications: notifications };
}

export async function parkingOccupancySummary() {
  const byStatus = await prisma.parkingSpot.groupBy({
    by: ["status"],
    _count: { _all: true },
    orderBy: { status: "asc" },
  });
  return byStatus.map((item) => ({ status: item.status, count: item._count._all }));
}
