import { z } from "zod";

export const mediaKeyParams = z.object({
  key: z.string().regex(/^[a-f0-9-]{36}\.(jpg|png|webp|mp4|webm)$/i),
});
