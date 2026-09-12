import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { env, TURNSTILE_ENABLED } from "../../config/env.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireTrustedCookieOrigin } from "../../middleware/csrfOrigin.js";
import { authRateLimit, sessionRateLimit } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/apiResponse.js";
import { badRequest } from "../../utils/errors.js";
import { login, logout, me, refresh, register, requestPasswordReset, resetPassword } from "./service.js";
import { loginSchema, registerSchema, resetPasswordSchema, resetRequestSchema } from "./validation.js";

const cookieOptions = { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "strict" as const, path: "/api" };
const isNativeClient = (header: string | undefined) => header === "native";

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

function sendSession(res: Response, tokens: Awaited<ReturnType<typeof login>>, nativeClient: boolean, status = 200) {
  if (!nativeClient) res.cookie("parko_refresh", tokens.refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.setHeader("Cache-Control", "no-store");
  if (nativeClient) return ok(res, tokens, undefined, status);
  const { refreshToken: _refreshToken, ...browserSession } = tokens;
  return ok(res, browserSession, undefined, status);
}

export const authRoutes = Router();

authRoutes.post("/register", authRateLimit, validate({ body: registerSchema }), verifyTurnstile, async (req, res, next) => {
  try {
    sendSession(res, await register(req.body, { ip: req.ip, userAgent: req.get("user-agent") }), isNativeClient(req.get("x-parko-client")), 201);
  } catch (error) {
    next(error);
  }
});

authRoutes.post("/login", authRateLimit, validate({ body: loginSchema }), verifyTurnstile, async (req, res, next) => {
  try {
    sendSession(res, await login(req.body, { ip: req.ip, userAgent: req.get("user-agent") }), isNativeClient(req.get("x-parko-client")));
  } catch (error) {
    next(error);
  }
});

authRoutes.post("/refresh", sessionRateLimit, requireTrustedCookieOrigin, async (req, res, next) => {
  try {
    const token = req.cookies?.parko_refresh ?? req.body?.refreshToken;
    if (typeof token !== "string" || token.length > 4096) { res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Session expired" } }); return; }
    sendSession(res, await refresh(token, { ip: req.ip, userAgent: req.get("user-agent") }), isNativeClient(req.get("x-parko-client")));
  } catch (error) {
    next(error);
  }
});

authRoutes.post("/logout", requireTrustedCookieOrigin, async (req, res, next) => {
  try {
    const token = req.cookies?.parko_refresh ?? req.body?.refreshToken;
    if (typeof token === "string") await logout(token);
    res.clearCookie("parko_refresh", cookieOptions);
    ok(res, { loggedOut: true });
  } catch (error) {
    next(error);
  }
});

authRoutes.post("/forgot-password", authRateLimit, validate({ body: resetRequestSchema }), async (req, res, next) => {
  try {
    await requestPasswordReset(req.body.email);
    res.setHeader("Cache-Control", "no-store");
    ok(res, { accepted: true }, undefined, 202);
  } catch (error) {
    next(error);
  }
});

authRoutes.post("/reset-password", authRateLimit, validate({ body: resetPasswordSchema }), async (req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    ok(res, await resetPassword(req.body.token, req.body.password));
  } catch (error) {
    next(error);
  }
});

authRoutes.get("/me", authenticate, async (req, res, next) => {
  try {
    ok(res, await me(req.user!.id));
  } catch (error) {
    next(error);
  }
});
