import { z } from "zod";

export const coordinatesQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().positive().max(10_000).default(1000),
  status: z.enum(["AVAILABLE", "OCCUPIED", "UNKNOWN", "RESERVED", "TEMPORARILY_UNAVAILABLE"]).optional(),
  zone: z.string().max(80).optional(),
  type: z.enum(["STREET", "GARAGE", "LOT", "PRIVATE", "ACCESSIBLE"]).optional()
});

export const createParkingSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(1000).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().max(200).optional(),
  zone: z.string().max(80).optional(),
  type: z.enum(["STREET", "GARAGE", "LOT", "PRIVATE", "ACCESSIBLE"]).default("STREET"),
  capacity: z.number().int().positive().optional()
});

export const idParams = z.object({ id: z.uuid() });
