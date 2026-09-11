import { parkingHistoryRepository } from "../repositories/parking-history.repository.js";
export class ParkingHistoryService {
  create(userId: string, input: { latitude: number; longitude: number; parkingSpotId?: string; note?: string }) { return parkingHistoryRepository.create({ ...input, userId }); }
  list(userId: string) { return parkingHistoryRepository.list(userId); }
}
export const parkingHistoryService = new ParkingHistoryService();
