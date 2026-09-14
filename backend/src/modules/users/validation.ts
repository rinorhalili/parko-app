import { z } from "zod";

export const userIdParams = z.object({ id: z.uuid() });
export const updateUserProfileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  username: z.string().min(3).max(40).optional(),
  avatar: z.url().optional(),
  bio: z.string().max(500).optional(),
});
