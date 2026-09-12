import type { NotificationType, Prisma } from "@prisma/client";
import webpush from "web-push";
import { env } from "../../config/env.js";
import { WEB_PUSH_ENABLED } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { prisma } from "../../database/prisma.js";
import { emitRealtime } from "../../websocket/io.js";

type CreateNotificationInput = {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Prisma.InputJsonValue;
};

export async function createNotification(input: CreateNotificationInput, db: Prisma.TransactionClient = prisma) {
  const notification = await db.notification.create({ data: input });
  emitRealtime("notification:new", notification, `user:${input.recipientId}`);
  return notification;
}

function validExpoToken(token: string) {
  return /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(token);
}

async function sendExpoMessages(messages: Array<{ to: string; title: string; body: string; data: Record<string, unknown> }>) {
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "Accept-Encoding": "gzip, deflate" },
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`Expo push gateway returned ${response.status}`);
}

function configureWebPush() {
  if (!WEB_PUSH_ENABLED) return;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

async function sendWebPushNotifications(
  subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>,
  notification: { id: string; type: NotificationType; title: string; message: string; data: Prisma.JsonValue | null }
) {
  configureWebPush();
  const payload = JSON.stringify({
    title: notification.title,
    body: notification.message,
    data: notification.data ?? {}
  });

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload);
    } catch (error) {
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? (error as { statusCode?: number }).statusCode : undefined;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.webPushSubscription.deleteMany({ where: { id: subscription.id } });
      }
      logger.warn({ notificationId: notification.id, subscriptionId: subscription.id, err: error }, "Web push delivery failed");
    }
  }
}

/** Delivers each persisted notification at most five times and never blocks the API request path. */
export async function deliverPendingPushNotifications() {
  if (!env.EXPO_PUSH_ENABLED && !WEB_PUSH_ENABLED) return { processed: 0, delivered: 0 };

  const pending = await prisma.notification.findMany({
    where: { pushDeliveredAt: null, pushAttempts: { lt: 5 } },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      recipient: {
        select: {
          pushDevices: { where: { enabled: true }, select: { token: true } },
          webPushSubscriptions: WEB_PUSH_ENABLED ? { select: { id: true, endpoint: true, p256dh: true, auth: true } } : false
        }
      }
    }
  });

  let delivered = 0;
  for (const notification of pending) {
    const tokens = notification.recipient.pushDevices.map((device) => device.token).filter(validExpoToken);
    try {
      if (env.EXPO_PUSH_ENABLED && tokens.length) {
        const payload = { notificationId: notification.id, type: notification.type };
        for (let offset = 0; offset < tokens.length; offset += 100) {
          await sendExpoMessages(tokens.slice(offset, offset + 100).map((to) => ({ to, title: notification.title, body: notification.message, data: payload })));
        }
      }
      if (WEB_PUSH_ENABLED) {
        await sendWebPushNotifications(notification.recipient.webPushSubscriptions, notification);
      }
      await prisma.notification.update({ where: { id: notification.id }, data: { pushDeliveredAt: new Date(), pushAttempts: { increment: 1 }, pushLastError: null } });
      delivered += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Push delivery failed";
      await prisma.notification.update({ where: { id: notification.id }, data: { pushAttempts: { increment: 1 }, pushLastError: message } });
      logger.warn({ notificationId: notification.id, err: error }, "Push delivery failed");
    }
  }
  return { processed: pending.length, delivered };
}
