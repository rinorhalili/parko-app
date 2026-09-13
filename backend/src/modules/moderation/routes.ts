import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { moderationController } from "../../controllers/moderation.controller.js";

const idParams = z.object({ id: z.uuid() });
const reportSchema = z.object({
  targetType: z.enum(["POST", "COMMENT", "PARKING_REPORT", "USER"]),
  targetId: z.string().min(1),
  reason: z.string().min(5).max(1000)
});
const reviewSchema = z.object({ status: z.enum(["REVIEWING", "RESOLVED", "DISMISSED"]), action: z.string().max(500).optional() });
const actionSchema = z.object({ targetType: z.string().min(1), targetId: z.string().min(1), action: z.string().min(2), reason: z.string().min(5) });
const listQuerySchema = z.object({ status: z.enum(["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"]).optional(), page: z.coerce.number().int().min(0).default(0) });

export const moderationRoutes = Router();

moderationRoutes.post("/reports", authenticate, validate({ body: reportSchema }), moderationController.createReport);

moderationRoutes.get("/reports", authenticate, authorize("MODERATOR"), validate({ query: listQuerySchema }), moderationController.listReports);

moderationRoutes.get("/reports/:id", authenticate, authorize("MODERATOR"), validate({ params: idParams }), moderationController.getReport);

moderationRoutes.patch("/reports/:id", authenticate, authorize("MODERATOR"), validate({ params: idParams, body: reviewSchema }), moderationController.review);

moderationRoutes.post("/actions", authenticate, authorize("MODERATOR"), validate({ body: actionSchema }), moderationController.createAction);
