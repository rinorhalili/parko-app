import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../database/prisma.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { ok } from "../../utils/apiResponse.js";

const idParams = z.object({ id: z.uuid() });
const deviceSchema = z.object({
  token: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/),
  platform: z.enum(["android", "ios"])
});
export const notificationRoutes = Router();

notificationRoutes.use(authenticate);

notificationRoutes.get("/", async (req, res, next) => {
  try {
    ok(res, await prisma.notification.findMany({ where: { recipientId: req.user!.id }, orderBy: { createdAt: "desc" }, take: 100 }));
  } catch (error) {
    next(error);
  }
});

notificationRoutes.post("/devices", validate({ body: deviceSchema }), async (req, res, next) => {
  try {
    ok(res, await prisma.pushDevice.upsert({
      where: { token: req.body.token },
      create: { userId: req.user!.id, token: req.body.token, platform: req.body.platform },
      update: { userId: req.user!.id, platform: req.body.platform, enabled: true }
    }), undefined, 201);
  } catch (error) {
    next(error);
  }
});

notificationRoutes.delete("/devices", validate({ body: deviceSchema.pick({ token: true }) }), async (req, res, next) => {
  try {
    await prisma.pushDevice.deleteMany({ where: { userId: req.user!.id, token: req.body.token } });
    ok(res, { deleted: true });
  } catch (error) {
    next(error);
  }
});

notificationRoutes.patch("/:id/read", validate({ params: idParams }), async (req, res, next) => {
  try {
    ok(res, await prisma.notification.update({ where: { id: req.params.id as string, recipientId: req.user!.id }, data: { readAt: new Date() } }));
  } catch (error) {
    next(error);
  }
});

notificationRoutes.post("/read-all", async (req, res, next) => {
  try {
    await prisma.notification.updateMany({ where: { recipientId: req.user!.id, readAt: null }, data: { readAt: new Date() } });
    ok(res, { readAll: true });
  } catch (error) {
    next(error);
  }
});

notificationRoutes.delete("/:id", validate({ params: idParams }), async (req, res, next) => {
  try {
    await prisma.notification.deleteMany({ where: { id: req.params.id as string, recipientId: req.user!.id } });
    ok(res, { deleted: true });
  } catch (error) {
    next(error);
  }
});
