import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/apiResponse.js";
import { cancelReservation, createReservation, listMyReservations, listSpotReservations } from "./service.js";
import { createReservationSchema, parkingSpotParams, reservationIdParams, reservationListQuery } from "./validation.js";

export const reservationRoutes = Router();

reservationRoutes.use(authenticate);

reservationRoutes.get("/me", validate({ query: reservationListQuery }), async (req, res, next) => {
  try {
    ok(res, await listMyReservations(req.user!.id, req.query as unknown as { page: number; pageSize: number; scope: "active" | "history" | "all" }));
  } catch (error) {
    next(error);
  }
});

reservationRoutes.get("/parking/:parkingSpotId", validate({ params: parkingSpotParams }), async (req, res, next) => {
  try {
    ok(res, await listSpotReservations(req.params.parkingSpotId as string));
  } catch (error) {
    next(error);
  }
});

reservationRoutes.post("/", validate({ body: createReservationSchema }), async (req, res, next) => {
  try {
    ok(res, await createReservation(req.user!.id, req.body), undefined, 201);
  } catch (error) {
    next(error);
  }
});

reservationRoutes.delete("/:id", validate({ params: reservationIdParams }), async (req, res, next) => {
  try {
    ok(res, await cancelReservation(req.user!.id, req.params.id as string));
  } catch (error) {
    next(error);
  }
});
