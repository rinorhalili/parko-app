import { z } from "zod";

export const parkingReportSchema = z.object({
  parkingSpotId: z.uuid(),
  status: z.enum(["AVAILABLE", "OCCUPIED", "UNKNOWN"]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  description: z.string().max(1000).optional(),
  confidence: z.number().int().min(0).max(100).default(60)
});
