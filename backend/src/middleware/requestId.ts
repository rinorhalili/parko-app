import type { NextFunction, Request, Response } from "express";
import { nanoid } from "nanoid";

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  req.id = req.header("x-request-id") ?? nanoid();
  res.setHeader("x-request-id", req.id);
  next();
}
