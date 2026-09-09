import type { NextFunction, Request, Response } from "express";
import { isTrustedOrigin } from "../config/env.js";
import { forbidden } from "../utils/errors.js";

/** Cookie-authenticated mutations must originate from the configured web client. */
export function requireTrustedCookieOrigin(req: Request, _res: Response, next: NextFunction) {
  if (!req.cookies?.parko_refresh) return next();
  const origin = req.get("origin");
  if (origin && isTrustedOrigin(origin)) return next();
  return next(forbidden("Invalid request origin"));
}
