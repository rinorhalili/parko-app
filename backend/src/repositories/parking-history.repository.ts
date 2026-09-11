import type { Prisma } from "@prisma/client";
import { prisma } from "../database/prisma.js";
export class ParkingHistoryRepository {
  create(data: Prisma.ParkedHistoryUncheckedCreateInput) { return prisma.parkedHistory.create({ data }); }
  list(userId: string) { return prisma.parkedHistory.findMany({ where: { userId }, orderBy: { parkedAt: "desc" }, take: 50 }); }
}
export const parkingHistoryRepository = new ParkingHistoryRepository();
