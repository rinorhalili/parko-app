import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/apiResponse.js";
import { listZones, parkingByZone } from "./service.js";
import { zoneParams } from "./validation.js";

export const zoneRoutes = Router();

zoneRoutes.get("/", async (_req, res, next) => {
  try {
    ok(res, await listZones());
  } catch (error) {
    next(error);
  }
});

zoneRoutes.get("/:zone/parking", validate({ params: zoneParams }), async (req, res, next) => {
  try {
    ok(res, await parkingByZone(String(req.params.zone)));
  } catch (error) {
    next(error);
  }
});
