import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { adminRoutes } from "./modules/admin/routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import { commentRoutes } from "./modules/comments/routes.js";
import { moderationRoutes } from "./modules/moderation/routes.js";
import { notificationRoutes } from "./modules/notifications/routes.js";
import { parkingRoutes } from "./modules/parking/routes.js";
import { postRoutes } from "./modules/posts/routes.js";
import { reactionRoutes } from "./modules/reactions/routes.js";
import { reportRoutes } from "./modules/reports/routes.js";
import { userRoutes } from "./modules/users/routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { generalRateLimit } from "./middleware/rateLimit.js";
import { requestId } from "./middleware/requestId.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId: (req) => req.id }));
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(generalRateLimit);

  app.get("/health", (_req, res) => res.json({ ok: true }));

  const api = express.Router();
  api.use("/auth", authRoutes);
  api.use("/users", userRoutes);
  api.use("/parking", parkingRoutes);
  api.use("/reports", reportRoutes);
  api.use("/posts", postRoutes);
  api.use(commentRoutes);
  api.use(reactionRoutes);
  api.use("/notifications", notificationRoutes);
  api.use("/moderation", moderationRoutes);
  api.use("/admin", adminRoutes);

  app.use("/api/v1", api);
  app.use(errorHandler);
  return app;
}
