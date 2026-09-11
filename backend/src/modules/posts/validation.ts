import { z } from "zod";

const imageUrl = z.string().trim().max(650_000).refine((value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || /^data:image\/(jpeg|png|webp);base64,/i.test(value);
  } catch { return false; }
}, "Media must be an HTTPS image URL or a supported image attachment");

export const postSchema = z.object({
  title: z.string().min(2).max(160),
  content: z.string().min(1).max(5000),
  parkingSpotId: z.uuid().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  media: z.array(z.object({ url: imageUrl, type: z.literal("image") })).max(1).optional()
});

export const idParams = z.object({ id: z.uuid() });
