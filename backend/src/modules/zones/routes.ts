import { Router } from "express";
import { zonesController } from "../../controllers/zones.controller.js";
import { validate } from "../../middleware/validate.js";
import { zoneParams } from "./validation.js";

export const zoneRoutes = Router();

zoneRoutes.get("/", zonesController.list);

zoneRoutes.get("/:zone/parking", validate({ params: zoneParams }), zonesController.parkingInZone);
