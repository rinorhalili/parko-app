import { prisma } from "../database/prisma.js";
import { syncReservationStatuses } from "../modules/reservations/service.js";

export async function expireReservationsJob(now = new Date()) {
  const expired = await prisma.parkingReservation.count({
    where: { cancelledAt: null, expiresAt: { lte: now } },
  });
  await syncReservationStatuses();
  return { expired };
}
