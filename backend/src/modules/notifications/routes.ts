import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { notificationController } from "../../controllers/notification.controller.js";

const idParams = z.object({ id: z.uuid() });
const deviceSchema = z.object({
  token: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/),
  platform: z.enum(["android", "ios"])
});
export const notificationRoutes = Router();

notificationRoutes.use(authenticate);

notificationRoutes.get("/", notificationController.list);


notificationRoutes.post("/devices", validate({ body: deviceSchema }), notificationController.registerDevice);

notificationRoutes.delete("/devices", validate({ body: deviceSchema.pick({ token: true }) }), notificationController.unregisterDevice);

notificationRoutes.patch("/:id/read", validate({ params: idParams }), notificationController.read);

notificationRoutes.post("/read-all", notificationController.markAllRead);

notificationRoutes.delete("/:id", validate({ params: idParams }), notificationController.deleteOne);
