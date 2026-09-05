import { Router } from "express";
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

reportRoutes.get("/parking", async (_req, res, next) => {
  try {
    ok(res, await listParkingReports());
  } catch (error) {
    next(error);
  }
});
