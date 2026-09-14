import type { NextFunction, Request, Response } from "express";
import { ok } from "../../utils/apiResponse.js";
import { getCurrentUser, getPublicUser, updateCurrentUser } from "./service.js";

export const usersController = {
  async me(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await getCurrentUser(req.user!.id));
    } catch (error) {
      next(error);
    }
  },
  async profile(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await getPublicUser(String(req.params.id)));
    } catch (error) {
      next(error);
    }
  },
  async updateMe(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await updateCurrentUser(req.user!.id, req.body));
    } catch (error) {
      next(error);
    }
  },
};
