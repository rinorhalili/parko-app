import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { analyticsController } from "./controller.js";

export const analyticsRoutes = Router();
analyticsRoutes.use(authenticate, authorize("MODERATOR"));
analyticsRoutes.get("/dashboard", analyticsController.dashboard);
analyticsRoutes.get("/parking-occupancy", analyticsController.occupancy);
