import type { NextFunction, Request, Response } from "express";
import { ok } from "../utils/apiResponse.js";
import { auditService } from "../services/audit.service.js";
export async function listAudit(req: Request, res: Response, next: NextFunction) { try { ok(res, await auditService.list(Number(req.query.page ?? 0), Number(req.query.pageSize ?? 100))); } catch (error) { next(error); } }
