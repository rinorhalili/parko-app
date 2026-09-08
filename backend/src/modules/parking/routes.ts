import { Router } from "express";
import { z } from 'zod';
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/apiResponse.js";
import { createParking, listParking, nearbyParking, parkingById } from "./service.js";
import { coordinatesQuery, createParkingSchema, idParams } from "./validation.js";

export const parkingRoutes = Router();

parkingRoutes.get("/", validate({ query: z.object({ page: z.coerce.number().int().min(0).max(100).default(0) }) }), async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=30');
    ok(res, await listParking(Number(req.query.page)));
  } catch (error) {
    next(error);
  }
});

parkingRoutes.get("/nearby", validate({ query: coordinatesQuery }), async (req, res, next) => {
  try {
    ok(res, await nearbyParking(req.query as never));
  } catch (error) {
    next(error);
  }
});

parkingRoutes.get("/:id", validate({ params: idParams }), async (req, res, next) => {
  try {
    ok(res, await parkingById(req.params.id as string));
  } catch (error) {
    next(error);
  }
});

parkingRoutes.post("/", authenticate, validate({ body: createParkingSchema }), async (req, res, next) => {
  try {
    ok(res, await createParking(req.user!.id, req.body), undefined, 201);
  } catch (error) {
    next(error);
  }
});
