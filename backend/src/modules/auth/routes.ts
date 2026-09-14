import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { env, TURNSTILE_ENABLED } from "../../config/env.js";
import { authController } from "../../controllers/auth.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireTrustedCookieOrigin } from "../../middleware/csrfOrigin.js";
import { authRateLimit, sessionRateLimit } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import { badRequest } from "../../utils/errors.js";
import { loginSchema, registerSchema, resetPasswordSchema, resetRequestSchema, verifyEmailSchema } from "./validation.js";

async function verifyTurnstile(req: Request, _res: Response, next: NextFunction) {
  if (!TURNSTILE_ENABLED) return next();
  const token = req.body?.turnstileToken;
  if (typeof token !== "string" || token.length > 2048) {
    return next(badRequest("Security verification failed. Please try again.", "TURNSTILE_FAILED"));
  }

  try {
    const verification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: req.ip }),
      signal: AbortSignal.timeout(10_000),
    });
    const result = await verification.json().catch(() => null) as { success?: boolean } | null;
    if (!verification.ok || !result?.success) {
      return next(badRequest("Security verification failed. Please try again.", "TURNSTILE_FAILED"));
    }
    return next();
  } catch {
    return next(badRequest("Security verification failed. Please try again.", "TURNSTILE_FAILED"));
  }
}

export const authRoutes = Router();

authRoutes.post("/register", authRateLimit, validate({ body: registerSchema }), verifyTurnstile, authController.register);

authRoutes.post("/login", authRateLimit, validate({ body: loginSchema }), verifyTurnstile, authController.login);

authRoutes.post("/refresh", sessionRateLimit, requireTrustedCookieOrigin, authController.refresh);

authRoutes.post("/logout", requireTrustedCookieOrigin, authController.logout);

authRoutes.post("/forgot-password", authRateLimit, validate({ body: resetRequestSchema }), authController.forgotPassword);

authRoutes.post("/reset-password", authRateLimit, validate({ body: resetPasswordSchema }), authController.resetPassword);

authRoutes.post("/verify-email/request", authenticate, authRateLimit, authController.requestEmailVerification);

authRoutes.post("/verify-email", authRateLimit, validate({ body: verifyEmailSchema }), authController.verifyEmail);

authRoutes.get("/me", authenticate, authController.me);
