import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { parkingReportRateLimit } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import { createReport, listReports, voteOnReport } from "../../controllers/report.controller.js";
import { parkingReportSchema } from "./validation.js";

export const reportRoutes = Router();

reportRoutes.post("/parking", authenticate, parkingReportRateLimit, validate({ body: parkingReportSchema }), createReport);

reportRoutes.get("/parking", validate({ query: z.object({
  page: z.coerce.number().int().min(0).max(1_000).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(100),
  parkingSpotId: z.string().min(1).max(120).optional()
}) }), listReports);

reportRoutes.put("/parking/:id/vote", authenticate, validate({ params: z.object({ id: z.uuid() }), body: z.object({ vote: z.boolean() }) }), voteOnReport);
