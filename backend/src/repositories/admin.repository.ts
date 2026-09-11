import type { Prisma } from "@prisma/client";
import { prisma } from "../database/prisma.js";
export class AdminRepository {
  listParking(where: Prisma.ParkingSpotWhereInput, skip: number) { return Promise.all([prisma.parkingSpot.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 50, skip }), prisma.parkingSpot.count({ where })]); }
  updateParking(id: string, data: Prisma.ParkingSpotUpdateInput) { return prisma.parkingSpot.update({ where: { id }, data }); }
  listUsers() { return prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 100, omit: { passwordHash: true } }); }
  updateUser(id: string, data: Prisma.UserUpdateInput) { return prisma.user.update({ where: { id }, data, omit: { passwordHash: true } }); }
  counts() { return Promise.all([prisma.user.count(), prisma.parkingReport.count(), prisma.post.count(), prisma.comment.count(), prisma.contentReport.count(), prisma.notification.count()]); }
}
export const adminRepository = new AdminRepository();
