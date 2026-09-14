import type { NextFunction, Request, Response } from "express";
import { searchParking } from "../modules/search/service.js";
import { ok } from "../utils/apiResponse.js";

export const searchController = {
  async search(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await searchParking(String(req.query.q)));
    } catch (error) {
      next(error);
    }
  }
};
