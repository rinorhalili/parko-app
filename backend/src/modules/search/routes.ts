import { Router } from "express";
import { z } from "zod";
import { searchController } from "../../controllers/search.controller.js";
import { validate } from "../../middleware/validate.js";

const searchQuery = z.object({ q: z.string().trim().min(1).max(120) });

export const searchRoutes = Router();
searchRoutes.get("/", validate({ query: searchQuery }), searchController.search);
