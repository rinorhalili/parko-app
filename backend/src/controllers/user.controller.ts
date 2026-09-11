import type { NextFunction, Request, Response } from "express";
import { userRepository } from "../repositories/user.repository.js";
import { ok } from "../utils/apiResponse.js";
export const userController = {
  async me(req: Request, res: Response, next: NextFunction) { try { ok(res, await userRepository.me(req.user!.id)); } catch (error) { next(error); } },
  async profile(req: Request, res: Response, next: NextFunction) { try { ok(res, await userRepository.publicProfile(String(req.params.id))); } catch (error) { next(error); } }
};
