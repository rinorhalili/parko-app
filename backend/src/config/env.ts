import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  LOG_LEVEL: z.string().default("info")
}).superRefine((value, context) => {
  if (value.NODE_ENV !== "production") return;
  for (const [key, secret] of [["JWT_ACCESS_SECRET", value.JWT_ACCESS_SECRET], ["JWT_REFRESH_SECRET", value.JWT_REFRESH_SECRET]] as const) {
    if (secret.toLowerCase().includes("change-me")) {
      context.addIssue({ code: "custom", path: [key], message: "must be replaced in production" });
    }
  }
  if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
    context.addIssue({ code: "custom", path: ["JWT_REFRESH_SECRET"], message: "must differ from JWT_ACCESS_SECRET in production" });
  }
  if (value.CORS_ORIGIN.split(",").some((origin) => origin.trim() === "*")) {
    context.addIssue({ code: "custom", path: ["CORS_ORIGIN"], message: "cannot include wildcard origins in production" });
  }
});

export const env = envSchema.parse(process.env);
export const corsOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);
