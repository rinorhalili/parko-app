import type { Prisma } from "@prisma/client";
import { prisma } from "../database/prisma.js";

export class ParkingRepository {
  findPublic(id: string) {
    return prisma.parkingSpot.findFirst({ where: { id, OR: [{ ownerId: null }, { verifiedAt: { not: null } }] }, include: { reports: { where: { expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, take: 10 } } });
  }
  findById(id: string) { return prisma.parkingSpot.findUnique({ where: { id } }); }
  listPublic(page: number, pageSize: number) {
    return prisma.parkingSpot.findMany({ where: { OR: [{ ownerId: null }, { verifiedAt: { not: null } }] }, orderBy: { id: "asc" }, take: pageSize, skip: page * pageSize });
  }
  create(data: Prisma.ParkingSpotUncheckedCreateInput) { return prisma.parkingSpot.create({ data }); }
  update(id: string, data: Prisma.ParkingSpotUpdateInput) { return prisma.parkingSpot.update({ where: { id }, data }); }
  activeReservations(parkingSpotId: string, now: Date) {
    return prisma.parkingReservation.count({ where: { parkingSpotId, cancelledAt: null, startsAt: { lte: now }, expiresAt: { gt: now } } });
  }
}

export const parkingRepository = new ParkingRepository();
