import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/apiResponse.js";
import { listSpotReservations } from "./service.js";
import { reservationController } from "../../controllers/reservation.controller.js";
import { createReservationSchema, parkingSpotParams, reservationIdParams, reservationListQuery } from "./validation.js";

export const reservationRoutes = Router();

reservationRoutes.use(authenticate);

reservationRoutes.get("/me", validate({ query: reservationListQuery }), reservationController.mine);

reservationRoutes.get("/parking/:parkingSpotId", validate({ params: parkingSpotParams }), async (req, res, next) => {
  try {
    ok(res, await listSpotReservations(req.params.parkingSpotId as string));
  } catch (error) {
    next(error);
  }
});

reservationRoutes.post("/", validate({ body: createReservationSchema }), reservationController.create);

reservationRoutes.delete("/:id", validate({ params: reservationIdParams }), reservationController.cancel);
