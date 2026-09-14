import { prisma } from "../../database/prisma.js";

export async function listZones() {
  const groups = await prisma.parkingSpot.groupBy({
    by: ["zone"],
    where: { zone: { not: null } },
    _count: { _all: true },
    orderBy: { zone: "asc" },
  });
  return groups.map((item) => ({ name: item.zone, parkingCount: item._count._all }));
}

export function parkingByZone(zone: string) {
  return prisma.parkingSpot.findMany({
    where: { zone },
    orderBy: [{ status: "asc" }, { title: "asc" }],
    take: 200,
  });
}
