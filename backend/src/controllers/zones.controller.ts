import type { NextFunction, Request, Response } from "express";
import { listZones, parkingByZone } from "../modules/zones/service.js";
import { ok } from "../utils/apiResponse.js";

export const zonesController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await listZones());
    } catch (error) {
      next(error);
    }
  },
  async parkingInZone(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await parkingByZone(String(req.params.zone)));
    } catch (error) {
      next(error);
    }
  }
};
