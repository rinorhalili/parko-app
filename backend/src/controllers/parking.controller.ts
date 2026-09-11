import type { NextFunction, Request, Response } from "express";
import { ok } from "../utils/apiResponse.js";
import * as parkingService from "../modules/parking/service.js";
export const parkingController = {
  async list(req: Request, res: Response, next: NextFunction) { try { ok(res, await parkingService.listParking(Number(req.query.page ?? 0))); } catch (error) { next(error); } },
  async detail(req: Request, res: Response, next: NextFunction) { try { ok(res, await parkingService.parkingById(String(req.params.id))); } catch (error) { next(error); } },
  async create(req: Request, res: Response, next: NextFunction) { try { ok(res, await parkingService.createParking(req.user!.id, req.body), undefined, 201); } catch (error) { next(error); } }
};
