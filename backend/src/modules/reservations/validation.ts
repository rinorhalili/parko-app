import { z } from "zod";

const reservationWindow = z.object({
  parkingSpotId: z.string().min(1).max(120),
  startsAt: z.coerce.date(),
  expiresAt: z.coerce.date()
}).superRefine(({ startsAt, expiresAt }, context) => {
  const now = Date.now();
  const duration = expiresAt.getTime() - startsAt.getTime();

  if (startsAt.getTime() < now - 5 * 60_000) {
    context.addIssue({ code: "custom", path: ["startsAt"], message: "Reservations cannot start in the past" });
  }
  if (duration < 15 * 60_000 || duration > 24 * 60 * 60_000) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "Reservations must last from 15 minutes to 24 hours" });
  }
});

export const createReservationSchema = reservationWindow;
export const reservationIdParams = z.object({ id: z.uuid() });
export const parkingSpotParams = z.object({ parkingSpotId: z.string().min(1).max(120) });
export const reservationListQuery = z.object({
  page: z.coerce.number().int().min(0).max(1_000).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  scope: z.enum(["active", "history", "all"]).default("active")
});
