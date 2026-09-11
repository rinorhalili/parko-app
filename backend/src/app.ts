import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { corsOrigins, env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { commentRoutes } from "./modules/comments/routes.js";
import { moderationRoutes } from "./modules/moderation/routes.js";
import { postRoutes } from "./modules/posts/routes.js";
import { reactionRoutes } from "./modules/reactions/routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { generalRateLimit } from "./middleware/rateLimit.js";
import { requestId } from "./middleware/requestId.js";
import { availabilityRoutes } from "./routes/availability.routes.js";
import { auditRoutes } from "./routes/audit.routes.js";
import { healthRoutes } from "./routes/health.routes.js";
import { communityRoutes } from "./routes/community.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { notificationRoutes } from "./routes/notification.routes.js";
import { parkingHistoryRoutes } from "./routes/parking-history.routes.js";
import { parkingRoutes } from "./routes/parking.routes.js";
import { reportRoutes } from "./routes/report.routes.js";
import { reservationRoutes } from "./routes/reservation.routes.js";
import { userRoutes } from "./routes/user.routes.js";
import { favoritesRoutes } from "./routes/favorites.routes.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (env.NODE_ENV === "production") app.set("trust proxy", 1);
  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId: (req) => req.id }));
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:", "https://*.basemaps.cartocdn.com", "https://*.tile.openstreetmap.org", "https://tile.openstreetmap.org"],
        connectSrc: ["'self'", "https://overpass.kumi.systems", "https://router.project-osrm.org", "https://valhalla1.openstreetmap.de"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
        formAction: ["'self'"]
      }
    }
  }));
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(generalRateLimit);

  app.use("/health", healthRoutes);

  const api = express.Router();
  api.use("/auth", authRoutes);
  api.use("/users", userRoutes);
  api.use("/favorites", favoritesRoutes);
  api.use("/parking", parkingRoutes);
  // Kept beside the legacy parking routes so /:id does not swallow availability.
  api.use("/parking", availabilityRoutes);
  api.use("/parking-history", parkingHistoryRoutes);
  api.use("/reports", reportRoutes);
  api.use("/reservations", reservationRoutes);
  api.use("/posts", postRoutes);
  api.use(commentRoutes);
  api.use(reactionRoutes);
  api.use("/notifications", notificationRoutes);
  api.use("/moderation", moderationRoutes);
  api.use("/admin", adminRoutes);
  api.use("/audit", auditRoutes);
  api.use("/community", communityRoutes);

  app.use("/api/v1", api);
  // The documented API path is available too; v1 remains the frontend default.
  app.use("/api", api);
  app.use(errorHandler);
  return app;
}
