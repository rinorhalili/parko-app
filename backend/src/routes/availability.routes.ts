import { Router } from "express";
import { z } from "zod";
import { getAvailability } from "../controllers/availability.controller.js";
import { validate } from "../middleware/validate.js";
export const availabilityRoutes = Router();
availabilityRoutes.get("/:id/availability", validate({ params: z.object({ id: z.uuid() }) }), getAvailability);
