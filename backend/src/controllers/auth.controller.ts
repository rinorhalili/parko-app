import type { NextFunction, Request, Response } from "express";
import * as authService from "../modules/auth/service.js";
import { ok } from "../utils/apiResponse.js";

/** HTTP-only auth handlers; session-cookie policy remains in the compatibility router. */
export const authController = {
  async me(req: Request, res: Response, next: NextFunction) { try { ok(res, await authService.me(req.user!.id)); } catch (error) { next(error); } }
};
