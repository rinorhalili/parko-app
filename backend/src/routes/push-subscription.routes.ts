import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { pushSubscriptionController } from "../modules/notifications/pushSubscription.controller.js";

const subscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) })
  })
});
const unsubscribeSchema = z.object({ endpoint: z.string().url() });

export const pushSubscriptionRoutes = Router();
pushSubscriptionRoutes.use(authenticate);
pushSubscriptionRoutes.post("/", validate({ body: subscriptionSchema }), pushSubscriptionController.create);
pushSubscriptionRoutes.delete("/", validate({ body: unsubscribeSchema }), pushSubscriptionController.remove);
