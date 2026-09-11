import { prisma } from "../database/prisma.js";

export class FavoritesRepository {
  list(userId: string) {
    return Promise.all([
      prisma.favoriteParking.findMany({ where: { userId }, select: { parkingSpotId: true }, orderBy: { createdAt: "desc" } }),
      prisma.favoritePost.findMany({ where: { userId }, select: { postId: true }, orderBy: { createdAt: "desc" } })
    ]);
  }
  saveParking(userId: string, parkingSpotId: string) { return prisma.favoriteParking.upsert({ where: { userId_parkingSpotId: { userId, parkingSpotId } }, create: { userId, parkingSpotId }, update: {} }); }
  removeParking(userId: string, parkingSpotId: string) { return prisma.favoriteParking.deleteMany({ where: { userId, parkingSpotId } }); }
  savePost(userId: string, postId: string) { return prisma.favoritePost.upsert({ where: { userId_postId: { userId, postId } }, create: { userId, postId }, update: {} }); }
  removePost(userId: string, postId: string) { return prisma.favoritePost.deleteMany({ where: { userId, postId } }); }
  listAlerts(userId: string) { return prisma.zoneAlert.findMany({ where: { userId }, orderBy: { zone: "asc" } }); }
  saveAlert(userId: string, zone: string) { return prisma.zoneAlert.upsert({ where: { userId_zone: { userId, zone } }, create: { userId, zone }, update: {} }); }
  removeAlert(userId: string, zone: string) { return prisma.zoneAlert.deleteMany({ where: { userId, zone } }); }
  eligibleAlertSubscribers(zone: string, reporterId: string, since: Date) { return prisma.zoneAlert.findMany({ where: { zone: { equals: zone, mode: "insensitive" }, userId: { not: reporterId }, OR: [{ lastNotifiedAt: null }, { lastNotifiedAt: { lt: since } }] }, select: { id: true, userId: true } }); }
  markAlertNotified(ids: string[], at: Date) { return ids.length ? prisma.zoneAlert.updateMany({ where: { id: { in: ids } }, data: { lastNotifiedAt: at } }) : Promise.resolve({ count: 0 }); }
}
export const favoritesRepository = new FavoritesRepository();
