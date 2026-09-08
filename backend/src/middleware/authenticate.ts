import type { NextFunction, Request, Response } from "express";
import { unauthorized } from "../utils/errors.js";
import { verifyAccessToken, type TokenUser } from "../utils/tokens.js";
import { prisma } from "../database/prisma.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenUser;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return next(unauthorized());

  try {
    const claims = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: claims.id }, select: { id: true, role: true, isActive: true } });
    if (!user?.isActive) return next(unauthorized("Account unavailable"));
    req.user = { id: user.id, role: user.role };
    return next();
  } catch {
    return next(unauthorized("Invalid or expired token"));
  }
}
