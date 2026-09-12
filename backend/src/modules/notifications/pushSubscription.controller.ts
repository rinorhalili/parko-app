import type { NextFunction, Request, Response } from "express";
import { prisma } from "../../database/prisma.js";
import { ok } from "../../utils/apiResponse.js";

export const pushSubscriptionController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const subscription = await prisma.webPushSubscription.upsert({
        where: { endpoint: req.body.subscription.endpoint },
        create: {
          userId: req.user!.id,
          endpoint: req.body.subscription.endpoint,
          p256dh: req.body.subscription.keys.p256dh,
          auth: req.body.subscription.keys.auth
        },
        update: {
          userId: req.user!.id,
          p256dh: req.body.subscription.keys.p256dh,
          auth: req.body.subscription.keys.auth
        }
      });
      ok(res, subscription, undefined, 201);
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.webPushSubscription.deleteMany({ where: { userId: req.user!.id, endpoint: req.body.endpoint } });
      ok(res, { deleted: true });
    } catch (error) {
      next(error);
    }
  }
};
