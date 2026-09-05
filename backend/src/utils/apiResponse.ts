import type { Response } from "express";

export function ok<T>(res: Response, data: T, meta?: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
}

export function empty(res: Response, status = 204) {
  return res.status(status).send();
}
