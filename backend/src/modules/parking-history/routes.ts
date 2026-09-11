import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { createParkingHistory, listParkingHistory } from "../../controllers/parking-history.controller.js";

const createParkedHistorySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  parkingSpotId: z.uuid().optional(),
  note: z.string().max(500).optional()
});

export const parkingHistoryRoutes = Router();

parkingHistoryRoutes.post("/", authenticate, validate({ body: createParkedHistorySchema }), createParkingHistory);

parkingHistoryRoutes.get("/", authenticate, listParkingHistory);
