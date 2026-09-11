import type { NextFunction, Request, Response } from "express";
import { ok } from "../utils/apiResponse.js";
import { availabilityService } from "../services/availability.service.js";
export async function getAvailability(req: Request, res: Response, next: NextFunction) { try { ok(res, await availabilityService.get(String(req.params.id))); } catch (error) { next(error); } }
