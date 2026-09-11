import { Router } from "express";
import { z } from "zod";
import { listAudit } from "../controllers/audit.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
export const auditRoutes = Router();
auditRoutes.use(authenticate, authorize("ADMIN"));
auditRoutes.get("/", validate({ query: z.object({ page: z.coerce.number().int().min(0).default(0), pageSize: z.coerce.number().int().min(1).max(200).default(100) }) }), listAudit);
