import { describe, expect, it } from "vitest";
import { createReservationSchema } from "../src/modules/reservations/validation.js";

describe("reservation input", () => {
  const parkingSpotId = "spot-1";

  it("accepts a bounded future reservation", () => {
    const startsAt = new Date(Date.now() + 10 * 60_000);
    const expiresAt = new Date(startsAt.getTime() + 60 * 60_000);
    expect(createReservationSchema.safeParse({ parkingSpotId, startsAt, expiresAt }).success).toBe(true);
  });

  it("rejects past, too-short, and too-long windows", () => {
    const now = Date.now();
    expect(createReservationSchema.safeParse({ parkingSpotId, startsAt: new Date(now - 6 * 60_000), expiresAt: new Date(now + 30 * 60_000) }).success).toBe(false);
    expect(createReservationSchema.safeParse({ parkingSpotId, startsAt: new Date(now + 60_000), expiresAt: new Date(now + 10 * 60_000) }).success).toBe(false);
    expect(createReservationSchema.safeParse({ parkingSpotId, startsAt: new Date(now + 60_000), expiresAt: new Date(now + 25 * 60 * 60_000) }).success).toBe(false);
  });
});
