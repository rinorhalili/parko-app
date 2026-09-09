import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { parkingReportRateLimit } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/apiResponse.js";
import { createParkingReport, listParkingReports } from "./service.js";
import { parkingReportSchema } from "./validation.js";

export const reportRoutes = Router();

reportRoutes.post("/parking", authenticate, parkingReportRateLimit, validate({ body: parkingReportSchema }), async (req, res, next) => {
  try {
    ok(res, await createParkingReport(req.user!.id, req.body), undefined, 201);
  } catch (error) {
    next(error);
  }
});

reportRoutes.get("/parking", validate({ query: z.object({
  page: z.coerce.number().int().min(0).max(1_000).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(100),
  parkingSpotId: z.string().min(1).max(120).optional()
}) }), async (req, res, next) => {
  try {
    ok(res, await listParkingReports(req.query as { page: number; pageSize: number; parkingSpotId?: string }));
  } catch (error) {
    next(error);
  }
});
