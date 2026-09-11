import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { adminController } from "../../controllers/admin.controller.js";

const idParams = z.object({ id: z.uuid() });
const userPatch = z.object({ isActive: z.boolean().optional(), isVerified: z.boolean().optional() });
const rolePatch = z.object({ role: z.enum(["USER", "MODERATOR", "ADMIN"]) });
const parkingPatch = z.object({
  action: z.enum(["approve", "disable"]),
  reason: z.string().trim().min(3).max(500).optional(),
  title: z.string().min(2).max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  zone: z.string().max(80).nullable().optional(),
  capacity: z.number().int().positive().nullable().optional()
});

export const adminRoutes = Router();
adminRoutes.use(authenticate, authorize("ADMIN"));

adminRoutes.get("/parking", validate({ query: z.object({ page: z.coerce.number().int().min(0).max(1000).default(0), q: z.string().trim().max(120).default(""), scope: z.enum(["pending", "all", "disabled"]).default("pending") }) }), adminController.listParking);

adminRoutes.patch("/parking/:id", validate({ params: z.object({ id: z.string().min(1).max(120) }), body: parkingPatch }), adminController.manageParking);

adminRoutes.get("/users", adminController.listUsers);

adminRoutes.patch("/users/:id", validate({ params: idParams, body: userPatch }), adminController.updateUser);

adminRoutes.patch("/users/:id/role", validate({ params: idParams, body: rolePatch }), adminController.updateRole);

adminRoutes.get("/analytics", adminController.analytics);

adminRoutes.get("/audit-logs", adminController.audit);
