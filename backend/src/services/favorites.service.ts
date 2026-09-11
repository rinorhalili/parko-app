import { favoritesRepository } from "../repositories/favorites.repository.js";
import { notFound } from "../utils/errors.js";
import { parkingRepository } from "../repositories/parking.repository.js";
import { communityRepository } from "../repositories/community.repository.js";
import { createNotification } from "../modules/notifications/service.js";
import { logger } from "../config/logger.js";

export class FavoritesService {
  async list(userId: string) { const [parking, posts] = await favoritesRepository.list(userId); return { parkingIds: parking.map((item) => item.parkingSpotId), postIds: posts.map((item) => item.postId) }; }
  async favoriteParking(userId: string, parkingSpotId: string) { if (!await parkingRepository.findById(parkingSpotId)) throw notFound("Parking spot not found"); return favoritesRepository.saveParking(userId, parkingSpotId); }
  removeParking(userId: string, parkingSpotId: string) { return favoritesRepository.removeParking(userId, parkingSpotId); }
  async favoritePost(userId: string, postId: string) { if (!await communityRepository.existsPublicPost(postId)) throw notFound("Post not found"); return favoritesRepository.savePost(userId, postId); }
  removePost(userId: string, postId: string) { return favoritesRepository.removePost(userId, postId); }
  async listAlerts(userId: string) { return favoritesRepository.listAlerts(userId); }
  subscribeZone(userId: string, zone: string) { return favoritesRepository.saveAlert(userId, zone.trim()); }
  removeAlert(userId: string, zone: string) { return favoritesRepository.removeAlert(userId, zone); }
  async notifyZoneAvailability(reporterId: string, zone: string | null, parking: { id: string; title: string }) {
    if (!zone) return 0;
    const now = new Date(); const subscribers = await favoritesRepository.eligibleAlertSubscribers(zone, reporterId, new Date(now.getTime() - 15 * 60_000));
    if (!subscribers.length) return 0;
    const results = await Promise.allSettled(subscribers.map((subscriber) => createNotification({ recipientId: subscriber.userId, type: "PARKING_UPDATE", title: "Vend i lirë në zonën tënde", message: `${parking.title} u raportua me vende të lira në ${zone}.`, data: { parkingSpotId: parking.id, zone } })));
    const deliveredIds = subscribers.filter((_, index) => results[index]?.status === "fulfilled").map((subscriber) => subscriber.id);
    if (deliveredIds.length) await favoritesRepository.markAlertNotified(deliveredIds, now);
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length) logger.warn({ zone, failed: failed.length }, "Zone alert notification delivery failed");
    return deliveredIds.length;
  }
}
export const favoritesService = new FavoritesService();
