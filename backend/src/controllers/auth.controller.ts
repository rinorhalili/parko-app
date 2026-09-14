import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { login, logout, me, refresh, register, requestEmailVerification, requestPasswordReset, resetPassword, verifyEmail } from "../modules/auth/service.js";
import { ok } from "../utils/apiResponse.js";

const cookieOptions = { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "strict" as const, path: "/api" };
const isNativeClient = (header: string | undefined) => header === "native";

function sendSession(res: Response, tokens: Awaited<ReturnType<typeof login>>, nativeClient: boolean, status = 200) {
  if (!nativeClient) res.cookie("parko_refresh", tokens.refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.setHeader("Cache-Control", "no-store");
  if (nativeClient) return ok(res, tokens, undefined, status);
  const { refreshToken: _refreshToken, ...browserSession } = tokens;
  return ok(res, browserSession, undefined, status);
}

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      sendSession(res, await register(req.body, { ip: req.ip, userAgent: req.get("user-agent") }), isNativeClient(req.get("x-parko-client")), 201);
    } catch (error) {
      next(error);
    }
  },
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      sendSession(res, await login(req.body, { ip: req.ip, userAgent: req.get("user-agent") }), isNativeClient(req.get("x-parko-client")));
    } catch (error) {
      next(error);
    }
  },
  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.parko_refresh ?? req.body?.refreshToken;
      if (typeof token !== "string" || token.length > 4096) { res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Session expired" } }); return; }
      sendSession(res, await refresh(token, { ip: req.ip, userAgent: req.get("user-agent") }), isNativeClient(req.get("x-parko-client")));
    } catch (error) {
      next(error);
    }
  },
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.parko_refresh ?? req.body?.refreshToken;
      if (typeof token === "string") await logout(token);
      res.clearCookie("parko_refresh", cookieOptions);
      ok(res, { loggedOut: true });
    } catch (error) {
      next(error);
    }
  },
  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await requestPasswordReset(req.body.email);
      res.setHeader("Cache-Control", "no-store");
      ok(res, { accepted: true }, undefined, 202);
    } catch (error) {
      next(error);
    }
  },
  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader("Cache-Control", "no-store");
      ok(res, await resetPassword(req.body.token, req.body.password));
    } catch (error) {
      next(error);
    }
  },
  async requestEmailVerification(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await requestEmailVerification(req.user!.id), undefined, 202);
    } catch (error) {
      next(error);
    }
  },
  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await verifyEmail(req.body.token));
    } catch (error) {
      next(error);
    }
  },
  async me(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await me(req.user!.id));
    } catch (error) {
      next(error);
    }
  }
};
