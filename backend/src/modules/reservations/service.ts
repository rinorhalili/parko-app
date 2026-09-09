import { Prisma, type ParkingStatus, type ParkingType } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { conflict, forbidden, notFound } from "../../utils/errors.js";
import { emitRealtime } from "../../websocket/io.js";
import { createNotification } from "../notifications/service.js";

const reservableTypes: ParkingType[] = ["PRIVATE", "GARAGE", "LOT"];
const unavailableStatuses: ParkingStatus[] = ["TEMPORARILY_UNAVAILABLE"];

function reservationWindowWhere(startsAt: Date, expiresAt: Date) {
  return {
    cancelledAt: null,
    startsAt: { lt: expiresAt },
    expiresAt: { gt: startsAt }
  };
}

export async function syncReservationStatuses(db: Prisma.TransactionClient = prisma, now = new Date()) {
  await db.parkingSpot.updateMany({
    where: {
      status: { not: "TEMPORARILY_UNAVAILABLE" },
      reservations: { some: { cancelledAt: null, startsAt: { lte: now }, expiresAt: { gt: now } } }
    },
    data: { status: "RESERVED", reportedAt: now }
  });

  await db.parkingSpot.updateMany({
    where: {
      status: "RESERVED",
      reservations: { none: { cancelledAt: null, startsAt: { lte: now }, expiresAt: { gt: now } } }
    },
    data: { status: "UNKNOWN", reportedAt: null }
  });
}

export async function createReservation(userId: string, input: { parkingSpotId: string; startsAt: Date; expiresAt: Date }) {
  try {
    const reservation = await prisma.$transaction(async (tx) => {
    const spot = await tx.parkingSpot.findUnique({ where: { id: input.parkingSpotId } });
    if (!spot) throw notFound("Parking spot not found");
    if (!spot.verifiedAt || !reservableTypes.includes(spot.type) || unavailableStatuses.includes(spot.status)) {
      throw forbidden("This parking spot cannot be reserved");
    }

    const overlapping = await tx.parkingReservation.count({
      where: { parkingSpotId: spot.id, ...reservationWindowWhere(input.startsAt, input.expiresAt) }
    });
    const capacity = spot.capacity ?? 1;
    if (overlapping >= capacity) throw conflict("This time window is no longer available");

    const created = await tx.parkingReservation.create({ data: { ...input, userId } });
    await tx.auditLog.create({ data: { actorId: userId, action: "parking.reservation.create", target: created.id, metadata: { parkingSpotId: spot.id } } });
    await createNotification({
      recipientId: userId,
      type: "SYSTEM",
      title: "Reservation confirmed",
      message: `Your reservation for ${spot.title} has been created.`,
      data: { reservationId: created.id, parkingSpotId: spot.id }
    }, tx);
    await syncReservationStatuses(tx);
    const currentSpot = await tx.parkingSpot.findUniqueOrThrow({ where: { id: spot.id }, select: { id: true, status: true, zone: true } });
    return { created, spot: currentSpot };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    emitRealtime("reservation:created", reservation.created, `user:${userId}`);
    emitRealtime("parking:updated", { parkingSpotId: reservation.spot.id, status: reservation.spot.status }, reservation.spot.zone ? `zone:${reservation.spot.zone}` : undefined);
    return reservation.created;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") throw conflict("This time window is no longer available");
    throw error;
  }
}

export async function listMyReservations(userId: string, { page, pageSize, scope }: { page: number; pageSize: number; scope: "active" | "history" | "all" }) {
  const now = new Date();
  const where = {
    userId,
    ...(scope === "active" ? { cancelledAt: null, expiresAt: { gt: now } } : scope === "history" ? { OR: [{ cancelledAt: { not: null } }, { expiresAt: { lte: now } }] } : {})
  };
  const [items, total] = await Promise.all([
    prisma.parkingReservation.findMany({
      where,
      orderBy: { startsAt: scope === "history" ? "desc" : "asc" },
      skip: page * pageSize,
      take: pageSize,
      include: { parkingSpot: { select: { id: true, title: true, address: true, latitude: true, longitude: true, zone: true, type: true } } }
    }),
    prisma.parkingReservation.count({ where })
  ]);
  return { items, total, page, pageSize };
}

export async function listSpotReservations(parkingSpotId: string) {
  const spot = await prisma.parkingSpot.findUnique({ where: { id: parkingSpotId }, select: { id: true } });
  if (!spot) throw notFound("Parking spot not found");
  const now = new Date();
  return prisma.parkingReservation.findMany({
    where: { parkingSpotId, cancelledAt: null, expiresAt: { gt: now } },
    select: { id: true, startsAt: true, expiresAt: true },
    orderBy: { startsAt: "asc" }
  });
}

export async function cancelReservation(userId: string, reservationId: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
    const reservation = await tx.parkingReservation.findUnique({ include: { parkingSpot: true }, where: { id: reservationId } });
    if (!reservation) throw notFound("Reservation not found");
    if (reservation.userId !== userId) throw forbidden("You cannot cancel this reservation");
    if (reservation.cancelledAt) return reservation;
    if (reservation.expiresAt <= new Date()) throw conflict("Expired reservations cannot be cancelled");

    const cancelled = await tx.parkingReservation.update({ where: { id: reservation.id }, data: { cancelledAt: new Date() } });
    await tx.auditLog.create({ data: { actorId: userId, action: "parking.reservation.cancel", target: reservation.id, metadata: { parkingSpotId: reservation.parkingSpotId } } });
    await syncReservationStatuses(tx);
    const currentSpot = await tx.parkingSpot.findUniqueOrThrow({ where: { id: reservation.parkingSpotId }, select: { id: true, status: true, zone: true } });
    return { ...cancelled, parkingSpot: currentSpot };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    emitRealtime("reservation:cancelled", { reservationId }, `user:${userId}`);
    emitRealtime("parking:updated", { parkingSpotId: result.parkingSpotId, status: result.parkingSpot.status }, result.parkingSpot.zone ? `zone:${result.parkingSpot.zone}` : undefined);
    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") throw conflict("Reservation was updated concurrently. Please retry.");
    throw error;
  }
}
