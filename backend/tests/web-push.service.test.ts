import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  notification: { findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  webPushSubscription: { deleteMany: vi.fn() }
}));
const webPush = vi.hoisted(() => ({ setVapidDetails: vi.fn(), sendNotification: vi.fn() }));

vi.mock("../src/database/prisma.js", () => ({ prisma: db }));
vi.mock("../src/config/env.js", () => ({
  env: { EXPO_PUSH_ENABLED: false, VAPID_SUBJECT: "mailto:support@parko.app", VAPID_PUBLIC_KEY: "public", VAPID_PRIVATE_KEY: "private" },
  WEB_PUSH_ENABLED: true
}));
vi.mock("../src/config/logger.js", () => ({ logger: { warn: vi.fn() } }));
vi.mock("../src/websocket/io.js", () => ({ emitRealtime: vi.fn() }));
vi.mock("web-push", () => ({ default: webPush }));

import { deliverPendingPushNotifications } from "../src/modules/notifications/service.js";

describe("web push notifications", () => {
  beforeEach(() => vi.resetAllMocks());

  it("delivers a persisted notification to each saved browser subscription", async () => {
    db.notification.findMany.mockResolvedValue([{
      id: "notice-1", type: "SYSTEM", title: "Njoftim", message: "Parkimi u ndryshua", data: { parkingSpotId: "spot-1" },
      recipient: {
        pushDevices: [],
        webPushSubscriptions: [{ id: "sub-1", endpoint: "https://push.example/sub", p256dh: "key", auth: "auth" }]
      }
    }]);
    db.notification.update.mockResolvedValue({});
    webPush.sendNotification.mockResolvedValue({});

    await expect(deliverPendingPushNotifications()).resolves.toEqual({ processed: 1, delivered: 1 });

    expect(webPush.setVapidDetails).toHaveBeenCalledWith("mailto:support@parko.app", "public", "private");
    expect(webPush.sendNotification).toHaveBeenCalledWith(
      { endpoint: "https://push.example/sub", keys: { p256dh: "key", auth: "auth" } },
      expect.stringContaining('"parkingSpotId":"spot-1"')
    );
  });

  it("removes expired subscriptions without blocking the remaining delivery", async () => {
    db.notification.findMany.mockResolvedValue([{
      id: "notice-1", type: "SYSTEM", title: "Njoftim", message: "Mesazh", data: null,
      recipient: {
        pushDevices: [],
        webPushSubscriptions: [
          { id: "expired", endpoint: "https://push.example/expired", p256dh: "key", auth: "auth" },
          { id: "active", endpoint: "https://push.example/active", p256dh: "key", auth: "auth" }
        ]
      }
    }]);
    db.notification.update.mockResolvedValue({});
    webPush.sendNotification.mockRejectedValueOnce({ statusCode: 410 }).mockResolvedValueOnce({});

    await deliverPendingPushNotifications();

    expect(db.webPushSubscription.deleteMany).toHaveBeenCalledWith({ where: { id: "expired" } });
    expect(webPush.sendNotification).toHaveBeenCalledTimes(2);
  });
});
