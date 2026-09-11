import type { Prisma } from "@prisma/client";
import { prisma } from "../database/prisma.js";

export class ReservationRepository {
  find(id: string) { return prisma.parkingReservation.findUnique({ where: { id }, include: { parkingSpot: true } }); }
  listForUser(userId: string, where: Prisma.ParkingReservationWhereInput, skip: number, take: number) {
    return Promise.all([prisma.parkingReservation.findMany({ where: { userId, ...where }, skip, take, orderBy: { startsAt: "asc" }, include: { parkingSpot: { select: { id: true, title: true, address: true, latitude: true, longitude: true, zone: true, type: true } } } }), prisma.parkingReservation.count({ where: { userId, ...where } })]);
  }
}
export const reservationRepository = new ReservationRepository();
