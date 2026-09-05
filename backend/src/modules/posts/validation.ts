import { z } from "zod";

export const postSchema = z.object({
  title: z.string().min(2).max(160),
  content: z.string().min(1).max(5000),
  parkingSpotId: z.uuid().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  media: z.array(z.object({ url: z.url(), type: z.string().max(40) })).max(8).optional()
});

export const idParams = z.object({ id: z.uuid() });
