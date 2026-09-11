import type { NextFunction, Request, Response } from "express";
import { notificationRepository } from "../repositories/notification.repository.js";
import { ok } from "../utils/apiResponse.js";
export const notificationController = {
  async list(req: Request, res: Response, next: NextFunction) { try { ok(res, await notificationRepository.list(req.user!.id)); } catch (error) { next(error); } },
  async read(req: Request, res: Response, next: NextFunction) { try { ok(res, await notificationRepository.markRead(String(req.params.id), req.user!.id)); } catch (error) { next(error); } }
};
