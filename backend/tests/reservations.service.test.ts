import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  parkingSpot: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn() },
  parkingReservation: { count: vi.fn(), create: vi.fn() },
  auditLog: { create: vi.fn() },
  notification: { create: vi.fn() },
  $transaction: vi.fn()
}));

vi.mock("../src/database/prisma.js", () => ({ prisma: db }));

import { createReservation } from "../src/modules/reservations/service.js";

const spot = {
  id: "spot-1",
  title: "Verified garage",
  zone: "center",
  type: "GARAGE" as const,
  status: "UNKNOWN" as const,
  capacity: 1,
  verifiedAt: new Date()
};

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((operation) => operation(db));
  db.parkingSpot.findUnique.mockResolvedValue(spot);
  db.parkingSpot.updateMany.mockResolvedValue({ count: 0 });
  db.parkingSpot.findUniqueOrThrow.mockResolvedValue({ id: spot.id, status: "RESERVED", zone: spot.zone });
});

describe("reservation service", () => {
  it("rejects an overlapping reservation when capacity is exhausted", async () => {
    db.parkingReservation.count.mockResolvedValue(1);

    await expect(createReservation("user-1", {
      parkingSpotId: spot.id,
      startsAt: new Date(Date.now() + 15 * 60_000),
      expiresAt: new Date(Date.now() + 75 * 60_000)
    })).rejects.toThrow("time window is no longer available");

    expect(db.parkingReservation.create).not.toHaveBeenCalled();
  });

  it("creates an available reservation within a serializable transaction", async () => {
    const created = { id: "reservation-1", parkingSpotId: spot.id };
    db.parkingReservation.count.mockResolvedValue(0);
    db.parkingReservation.create.mockResolvedValue(created);

    await expect(createReservation("user-1", {
      parkingSpotId: spot.id,
      startsAt: new Date(Date.now() + 15 * 60_000),
      expiresAt: new Date(Date.now() + 75 * 60_000)
    })).resolves.toEqual(created);

    expect(db.parkingReservation.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: "user-1" }) }));
    expect(db.$transaction.mock.calls[0][1]).toEqual(expect.objectContaining({ isolationLevel: "Serializable" }));
  });
});
