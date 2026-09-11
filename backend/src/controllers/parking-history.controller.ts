import type { NextFunction, Request, Response } from "express";
import { parkingHistoryService } from "../services/parking-history.service.js";
import { ok } from "../utils/apiResponse.js";
export async function createParkingHistory(req: Request, res: Response, next: NextFunction) { try { ok(res, await parkingHistoryService.create(req.user!.id, req.body), undefined, 201); } catch (error) { next(error); } }
export async function listParkingHistory(req: Request, res: Response, next: NextFunction) { try { ok(res, await parkingHistoryService.list(req.user!.id)); } catch (error) { next(error); } }
