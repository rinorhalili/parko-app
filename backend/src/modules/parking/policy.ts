import type { ParkingStatus } from '@prisma/client';

export const REPORT_TTL_MS = 30 * 60_000;
export const publicParkingWhere = { OR: [{ ownerId: null }, { verifiedAt: { not: null } }] };

export function effectiveStatus<T extends { status: ParkingStatus; reportedAt: Date | null }>(spot: T, now = Date.now()): T {
  if (['AVAILABLE', 'OCCUPIED'].includes(spot.status) && (!spot.reportedAt || now - spot.reportedAt.getTime() >= REPORT_TTL_MS)) {
    return { ...spot, status: 'UNKNOWN' };
  }
  return spot;
}
