import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authRateLimit } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/apiResponse.js";
import { login, logout, me, refresh, register } from "./service.js";
import { loginSchema, refreshSchema, registerSchema, resetPasswordSchema, resetRequestSchema } from "./validation.js";

export const authRoutes = Router();

authRoutes.post("/register", authRateLimit, validate({ body: registerSchema }), async (req, res, next) => {
  try {
    ok(res, await register(req.body, { ip: req.ip, userAgent: req.get("user-agent") }), undefined, 201);
  } catch (error) {
    next(error);
  }
});

authRoutes.post("/login", authRateLimit, validate({ body: loginSchema }), async (req, res, next) => {
  try {
    ok(res, await login(req.body, { ip: req.ip, userAgent: req.get("user-agent") }));
  } catch (error) {
    next(error);
  }
});

authRoutes.post("/refresh", validate({ body: refreshSchema }), async (req, res, next) => {
  try {
    ok(res, await refresh(req.body.refreshToken));
  } catch (error) {
    next(error);
  }
});

authRoutes.post("/logout", async (req, res, next) => {
  try {
    await logout(req.body?.refreshToken);
    ok(res, { loggedOut: true });
  } catch (error) {
    next(error);
  }
});

authRoutes.post("/forgot-password", validate({ body: resetRequestSchema }), (_req, res) => {
  ok(res, { accepted: true });
});

authRoutes.post("/reset-password", validate({ body: resetPasswordSchema }), (_req, res) => {
  ok(res, { accepted: true });
});

authRoutes.get("/me", authenticate, async (req, res, next) => {
  try {
    ok(res, await me(req.user!.id));
  } catch (error) {
    next(error);
  }
});
