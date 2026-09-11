import { Router } from "express";
import { z } from 'zod';
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/apiResponse.js";
import { nearbyParking } from "./service.js";
import { parkingController } from "../../controllers/parking.controller.js";
import { coordinatesQuery, createParkingSchema, idParams } from "./validation.js";

export const parkingRoutes = Router();

parkingRoutes.get("/", validate({ query: z.object({ page: z.coerce.number().int().min(0).max(100).default(0) }) }), (req, res, next) => { res.setHeader('Cache-Control', 'public, max-age=30'); return parkingController.list(req, res, next); });

parkingRoutes.get("/nearby", validate({ query: coordinatesQuery }), async (req, res, next) => {
  try {
    ok(res, await nearbyParking(req.query as never));
  } catch (error) {
    next(error);
  }
});

parkingRoutes.get("/:id", validate({ params: idParams }), parkingController.detail);

parkingRoutes.post("/", authenticate, validate({ body: createParkingSchema }), parkingController.create);
