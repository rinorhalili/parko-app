import { prisma } from "../database/prisma.js";
export class NotificationRepository {
  list(recipientId: string, take = 100) { return prisma.notification.findMany({ where: { recipientId }, orderBy: { createdAt: "desc" }, take }); }
  markRead(id: string, recipientId: string) { return prisma.notification.update({ where: { id, recipientId }, data: { readAt: new Date() } }); }
  markAllRead(recipientId: string) { return prisma.notification.updateMany({ where: { recipientId, readAt: null }, data: { readAt: new Date() } }); }
}
export const notificationRepository = new NotificationRepository();
