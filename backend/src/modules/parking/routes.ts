import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/apiResponse.js";
import { createParking, listParking, nearbyParking, parkingById } from "./service.js";
import { coordinatesQuery, createParkingSchema, idParams } from "./validation.js";

export const parkingRoutes = Router();

parkingRoutes.get("/", async (_req, res, next) => {
  try {
    ok(res, await listParking());
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
