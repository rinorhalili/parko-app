import type { NextFunction, Request, Response } from "express";
import { unauthorized } from "../utils/errors.js";
import { verifyAccessToken, type TokenUser } from "../utils/tokens.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenUser;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return next(unauthorized());

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    return next(unauthorized("Invalid or expired token"));
  }
}
