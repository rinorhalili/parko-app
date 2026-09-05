import type { NextFunction, Request, Response } from "express";
import { forbidden, unauthorized } from "../utils/errors.js";

const rank = { USER: 1, MODERATOR: 2, ADMIN: 3 } as const;

export function authorize(minRole: keyof typeof rank) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (rank[req.user.role] < rank[minRole]) return next(forbidden());
    return next();
  };
}
