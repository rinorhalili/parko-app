import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError } from "../utils/errors.js";

function reportUnexpectedError(error: unknown, requestId: string) {
  if (!env.SENTRY_DSN) return;
  void fetch(env.SENTRY_DSN, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event_id: requestId, level: "error", platform: "node", exception: { values: [{ type: error instanceof Error ? error.name : "Error", value: error instanceof Error ? error.message : "Unknown error" }] } }), signal: AbortSignal.timeout(2_000) }).catch(() => undefined);
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof AppError) {
    return res.status(error.status).json({ success: false, error: { code: error.code, message: error.message, requestId: req.id } });
  }

  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({ success: false, error: { code: "INVALID_JSON", message: "Invalid JSON request body", requestId: req.id } });
  }

  if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.too.large") {
    return res.status(413).json({ success: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large", requestId: req.id } });
  }

  logger.error({ err: error, requestId: req.id }, "Unhandled API error");
  reportUnexpectedError(error, String(req.id));
  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: env.NODE_ENV === "production" ? "Internal server error" : error instanceof Error ? error.message : "Unknown error",
      requestId: req.id
    }
  });
}
