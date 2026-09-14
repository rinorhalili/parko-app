import type { NextFunction, Request, Response } from "express";
import { prisma } from "../database/prisma.js";
import { notificationRepository } from "../repositories/notification.repository.js";
import { ok } from "../utils/apiResponse.js";

export const notificationController = {
  async list(req: Request, res: Response, next: NextFunction) { try { ok(res, await notificationRepository.list(req.user!.id)); } catch (error) { next(error); } },
  async read(req: Request, res: Response, next: NextFunction) { try { ok(res, await notificationRepository.markRead(String(req.params.id), req.user!.id)); } catch (error) { next(error); } },
  async registerDevice(req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await prisma.pushDevice.upsert({
        where: { token: req.body.token },
        create: { userId: req.user!.id, token: req.body.token, platform: req.body.platform },
        update: { userId: req.user!.id, platform: req.body.platform, enabled: true }
      }), undefined, 201);
    } catch (error) {
      next(error);
    }
  },
  async unregisterDevice(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.pushDevice.deleteMany({ where: { userId: req.user!.id, token: req.body.token } });
      ok(res, { deleted: true });
    } catch (error) {
      next(error);
    }
  },
  async markAllRead(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.notification.updateMany({ where: { recipientId: req.user!.id, readAt: null }, data: { readAt: new Date() } });
      ok(res, { readAll: true });
    } catch (error) {
      next(error);
    }
  },
  async deleteOne(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.notification.deleteMany({ where: { id: req.params.id as string, recipientId: req.user!.id } });
      ok(res, { deleted: true });
    } catch (error) {
      next(error);
    }
  }
};
