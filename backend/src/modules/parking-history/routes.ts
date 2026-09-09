import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../database/prisma.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/apiResponse.js";

const createParkedHistorySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  parkingSpotId: z.uuid().optional(),
  note: z.string().max(500).optional()
});

export const parkingHistoryRoutes = Router();

parkingHistoryRoutes.post("/", authenticate, validate({ body: createParkedHistorySchema }), async (req, res, next) => {
  try {
    ok(res, await prisma.parkedHistory.create({ data: { ...req.body, userId: req.user!.id } }));
  } catch (error) {
    next(error);
  }
});

parkingHistoryRoutes.get("/", authenticate, async (req, res, next) => {
  try {
    ok(res, await prisma.parkedHistory.findMany({ where: { userId: req.user!.id }, orderBy: { parkedAt: "desc" }, take: 50 }));
  } catch (error) {
    next(error);
  }
});
