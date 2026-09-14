import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { getReputation } from "./controller.js";
import { reputationParams } from "./validation.js";

export const reputationRoutes = Router();
reputationRoutes.get("/:userId", validate({ params: reputationParams }), getReputation);
