import type { NextFunction, Request, Response } from "express";
import { moderationService } from "../services/moderation.service.js";
import { ok } from "../utils/apiResponse.js";
const run = (fn: (req: Request) => Promise<unknown>, status = 200) => async (req: Request, res: Response, next: NextFunction) => { try { ok(res, await fn(req), undefined, status); } catch (error) { next(error); } };
export const moderationController = {
  createReport: run((r) => moderationService.createReport(r.user!.id, r.body), 201), listReports: run(() => moderationService.listReports()), getReport: run((r) => moderationService.getReport(String(r.params.id))), review: run((r) => moderationService.review(String(r.params.id), r.user!.id, r.body)), createAction: run((r) => moderationService.createAction(r.user!.id, r.body), 201)
};
