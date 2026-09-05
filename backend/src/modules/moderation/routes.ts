import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../database/prisma.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/apiResponse.js";
import { emitRealtime } from "../../websocket/io.js";

const idParams = z.object({ id: z.uuid() });
const reportSchema = z.object({
  targetType: z.enum(["POST", "COMMENT", "PARKING_REPORT", "USER"]),
  targetId: z.string().min(1),
  reason: z.string().min(5).max(1000)
});
const reviewSchema = z.object({ status: z.enum(["REVIEWING", "RESOLVED", "DISMISSED"]), action: z.string().max(500).optional() });
const actionSchema = z.object({ targetType: z.string().min(1), targetId: z.string().min(1), action: z.string().min(2), reason: z.string().min(5) });

export const moderationRoutes = Router();

moderationRoutes.post("/reports", authenticate, validate({ body: reportSchema }), async (req, res, next) => {
  try {
    ok(res, await prisma.contentReport.create({ data: { ...req.body, reporterId: req.user!.id } }), undefined, 201);
  } catch (error) {
    next(error);
  }
});

moderationRoutes.get("/reports", authenticate, authorize("MODERATOR"), async (_req, res, next) => {
  try {
    ok(res, await prisma.contentReport.findMany({ orderBy: { createdAt: "desc" }, take: 100 }));
  } catch (error) {
    next(error);
  }
});

moderationRoutes.get("/reports/:id", authenticate, authorize("MODERATOR"), validate({ params: idParams }), async (req, res, next) => {
  try {
    ok(res, await prisma.contentReport.findUniqueOrThrow({ where: { id: req.params.id as string } }));
  } catch (error) {
    next(error);
  }
});

moderationRoutes.patch("/reports/:id", authenticate, authorize("MODERATOR"), validate({ params: idParams, body: reviewSchema }), async (req, res, next) => {
  try {
    const updated = await prisma.contentReport.update({ where: { id: req.params.id as string }, data: { ...req.body, moderatorId: req.user!.id, resolvedAt: req.body.status === "RESOLVED" ? new Date() : undefined } });
    emitRealtime("moderation:update", updated, "community");
    ok(res, updated);
  } catch (error) {
    next(error);
  }
});

moderationRoutes.post("/actions", authenticate, authorize("MODERATOR"), validate({ body: actionSchema }), async (req, res, next) => {
  try {
    const action = await prisma.moderationAction.create({ data: { ...req.body, moderatorId: req.user!.id } });
    await prisma.auditLog.create({ data: { actorId: req.user!.id, action: `moderation.${req.body.action}`, target: `${req.body.targetType}:${req.body.targetId}` } });
    ok(res, action, undefined, 201);
  } catch (error) {
    next(error);
  }
});
