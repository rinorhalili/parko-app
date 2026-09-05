import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2).max(80),
  username: z.string().min(3).max(40).regex(/^[a-zA-Z0-9_]+$/),
  email: z.email(),
  password: z.string().min(8).max(128)
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1)
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20)
});

export const resetRequestSchema = z.object({ email: z.email() });
export const resetPasswordSchema = z.object({ token: z.string().min(20), password: z.string().min(8).max(128) });
