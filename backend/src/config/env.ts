import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  JWT_ISSUER: z.string().min(1).default("parko-api"),
  JWT_AUDIENCE: z.string().min(1).default("parko-clients"),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  LOG_LEVEL: z.string().default("info"),
  PASSWORD_RESET_WEB_URL: z.string().url().optional(),
  EMAIL_VERIFICATION_WEB_URL: z.string().url().optional(),
  PASSWORD_RESET_DELIVERY_URL: z.string().url().optional(),
  PASSWORD_RESET_DELIVERY_TOKEN: z.string().min(16).optional(),
  RESEND_API_KEY: z.string().min(16).optional(),
  // Resend supports both `name@domain.tld` and `Name <name@domain.tld>`.
  EMAIL_FROM: z.string().min(3).max(320).optional(),
  EXPO_PUSH_ENABLED: z.coerce.boolean().default(false),
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).default("mailto:support@parko.app"),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional()
  ,S3_ENDPOINT: z.string().url().optional()
  ,S3_REGION: z.string().min(1).default("us-east-1")
  ,S3_BUCKET: z.string().min(3).max(63).default("parko-media")
  ,S3_ACCESS_KEY_ID: z.string().min(3).optional()
  ,S3_SECRET_ACCESS_KEY: z.string().min(8).optional()
  ,CLAMAV_HOST: z.string().min(1).optional()
  ,CLAMAV_PORT: z.coerce.number().int().positive().default(3310)
  ,SENTRY_DSN: z.string().url().optional()
}).superRefine((value, context) => {
  if (value.NODE_ENV !== "production") return;
  for (const [key, secret] of [["JWT_ACCESS_SECRET", value.JWT_ACCESS_SECRET], ["JWT_REFRESH_SECRET", value.JWT_REFRESH_SECRET]] as const) {
    if (/(change-me|replace-with|example|test-)/i.test(secret)) {
      context.addIssue({ code: "custom", path: [key], message: "must be replaced in production" });
    }
  }
  if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
    context.addIssue({ code: "custom", path: ["JWT_REFRESH_SECRET"], message: "must differ from JWT_ACCESS_SECRET in production" });
  }
  if (value.CORS_ORIGIN.split(",").some((origin) => origin.trim() === "*")) {
    context.addIssue({ code: "custom", path: ["CORS_ORIGIN"], message: "cannot include wildcard origins in production" });
  }
  if (!value.TURNSTILE_SECRET_KEY) {
    context.addIssue({ code: "custom", path: ["TURNSTILE_SECRET_KEY"], message: "is required in production" });
  }
  for (const key of ["S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "CLAMAV_HOST"] as const) {
    if (!value[key]) context.addIssue({ code: "custom", path: [key], message: "is required in production" });
  }
});

export const env = envSchema.parse(process.env);
export const corsOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);
export const isTrustedOrigin = (origin: string) => corsOrigins.includes(origin);
/** Web Push is only usable when both halves of the VAPID keypair are configured. */
export const WEB_PUSH_ENABLED = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
/** Turnstile remains off for local development unless a secret has been configured. */
export const TURNSTILE_ENABLED = Boolean(env.TURNSTILE_SECRET_KEY);
