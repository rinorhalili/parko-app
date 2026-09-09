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
  const provided = req.header("x-request-id");
  req.id = provided && /^[a-zA-Z0-9_-]{8,128}$/.test(provided) ? provided : nanoid();
  res.setHeader("x-request-id", req.id);
  next();
}
