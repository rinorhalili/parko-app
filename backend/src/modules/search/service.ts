import { prisma } from "../../database/prisma.js";

export function searchParking(query: string) {
  const q = query.trim();
  if (!q) return Promise.resolve([]);
  return prisma.parkingSpot.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { address: { contains: q, mode: "insensitive" } },
        { zone: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [{ verifiedAt: "desc" }, { title: "asc" }],
    take: 50,
  });
}
