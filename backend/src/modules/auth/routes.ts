import { Router } from "express";
import type { Response } from "express";
import { env } from "../../config/env.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireTrustedCookieOrigin } from "../../middleware/csrfOrigin.js";
import { authRateLimit } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/apiResponse.js";
import { login, logout, me, refresh, register, requestPasswordReset, resetPassword } from "./service.js";
import { loginSchema, registerSchema, resetPasswordSchema, resetRequestSchema } from "./validation.js";

const cookieOptions = { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "strict" as const, path: "/api/v1/auth" };
function sendSession(res: Response, tokens: Awaited<ReturnType<typeof login>>, status = 200) {
  res.cookie("parko_refresh", tokens.refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.setHeader("Cache-Control", "no-store");
  const { refreshToken: _refreshToken, ...publicSession } = tokens;
  ok(res, publicSession, undefined, status);
}

export const authRoutes = Router();

authRoutes.post("/register", authRateLimit, validate({ body: registerSchema }), async (req, res, next) => {
  try {
    sendSession(res, await register(req.body, { ip: req.ip, userAgent: req.get("user-agent") }), 201);
  } catch (error) {
    next(error);
  }
});

authRoutes.post("/login", authRateLimit, validate({ body: loginSchema }), async (req, res, next) => {
  try {
    sendSession(res, await login(req.body, { ip: req.ip, userAgent: req.get("user-agent") }));
  } catch (error) {
    next(error);
  }
});

authRoutes.post("/refresh", authRateLimit, requireTrustedCookieOrigin, async (req, res, next) => {
  try {
    const token = req.cookies?.parko_refresh ?? req.body?.refreshToken;
    if (typeof token !== "string" || token.length > 4096) { res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Session expired" } }); return; }
    sendSession(res, await refresh(token, { ip: req.ip, userAgent: req.get("user-agent") }));
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
