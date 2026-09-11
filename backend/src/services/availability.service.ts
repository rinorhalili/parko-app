import { parkingRepository } from "../repositories/parking.repository.js";
import { redis } from "../database/redis.js";
import { notFound } from "../utils/errors.js";

export type Availability = { parkingId: string; totalSpaces: number; availableSpaces: number; occupiedSpaces: number; reservedSpaces: number; status: string; updatedAt: Date };
const key = (id: string) => `parking:availability:${id}`;

export class AvailabilityService {
  async get(parkingId: string): Promise<Availability> {
    try { const cached = await redis.get(key(parkingId)); if (cached) return JSON.parse(cached) as Availability; } catch { /* cache outages must not take down parking */ }
    const spot = await parkingRepository.findById(parkingId);
    if (!spot) throw notFound("Parking spot not found");
    const reservedSpaces = await parkingRepository.activeReservations(parkingId, new Date());
    const totalSpaces = spot.capacity ?? 1;
    const occupiedSpaces = spot.status === "OCCUPIED" ? totalSpaces : 0;
    const availableSpaces = spot.status === "TEMPORARILY_UNAVAILABLE" ? 0 : Math.max(0, totalSpaces - occupiedSpaces - reservedSpaces);
    const value: Availability = { parkingId, totalSpaces, availableSpaces, occupiedSpaces, reservedSpaces, status: availableSpaces > 0 ? "AVAILABLE" : "OCCUPIED", updatedAt: spot.updatedAt };
    try { await redis.set(key(parkingId), JSON.stringify(value), "EX", 30); } catch { /* best effort */ }
    return value;
  }
  async invalidate(parkingId: string) { try { await redis.del(key(parkingId)); } catch { /* best effort */ } }
}
export const availabilityService = new AvailabilityService();
