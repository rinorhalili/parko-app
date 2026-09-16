import type { NextFunction, Request, Response } from "express";
import { adminService } from "../services/admin.service.js";
import { ok } from "../utils/apiResponse.js";
import { auditService } from "../services/audit.service.js";
const run = (fn: (req: Request) => Promise<unknown>) => async (req: Request, res: Response, next: NextFunction) => { try { ok(res, await fn(req)); } catch (error) { next(error); } };
export const adminController = {
  listParking: run((r) => adminService.listParking(Number(r.query.page), String(r.query.q), String(r.query.scope))), manageParking: run((r) => adminService.manageParking(r.user!.id, String(r.params.id), r.body)),
  createParkingPoint: run((r) => adminService.createParkingPoint(r.user!.id, r.body)),
  updateParkingPoint: run((r) => adminService.updateParkingPoint(r.user!.id, String(r.params.id), r.body)),
  deleteParkingPoint: run((r) => adminService.deleteParkingPoint(r.user!.id, String(r.params.id))),
  listUsers: run(() => adminService.listUsers()), updateUser: run((r) => adminService.updateUser(r.user!.id, r.user!.id, String(r.params.id), r.body)), updateRole: run((r) => adminService.updateRole(r.user!.id, String(r.params.id), r.body.role)), analytics: run(() => adminService.analytics()), audit: run(() => auditService.list(0, 200))
};
