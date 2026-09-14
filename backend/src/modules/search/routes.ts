import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/apiResponse.js";
import { searchParking } from "./service.js";

const searchQuery = z.object({ q: z.string().trim().min(1).max(120) });

export const searchRoutes = Router();
searchRoutes.get("/", validate({ query: searchQuery }), async (req, res, next) => {
  try {
    ok(res, await searchParking(String(req.query.q)));
  } catch (error) {
    next(error);
  }
});
