import type { NextFunction, Request, Response } from "express";
import { ok } from "../../utils/apiResponse.js";
import { dashboardAnalytics, parkingOccupancySummary } from "./service.js";

export const analyticsController = {
  async dashboard(_req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await dashboardAnalytics());
    } catch (error) {
      next(error);
    }
  },
  async occupancy(_req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await parkingOccupancySummary());
    } catch (error) {
      next(error);
    }
  },
};
