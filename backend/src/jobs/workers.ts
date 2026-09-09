import { Worker } from "bullmq";
import { logger } from "../config/logger.js";
import { redis } from "../database/redis.js";
import { prisma } from "../database/prisma.js";
import { syncReservationStatuses } from "../modules/reservations/service.js";
import { deliverPendingPushNotifications } from "../modules/notifications/service.js";

export function startWorkers() {
  const reportWorker = new Worker(
    "report-expiration",
    async () => {
      await prisma.parkingReport.updateMany({
        where: { expiresAt: { lt: new Date() }, confidence: { gt: 0 } },
        data: { confidence: 0 }
      });
      await prisma.parkingSpot.updateMany({
        where: { status: { in: ['AVAILABLE', 'OCCUPIED'] }, OR: [{ reportedAt: null }, { reportedAt: { lte: new Date(Date.now() - 30 * 60_000) } }] },
        data: { status: 'UNKNOWN' }
      });
      await syncReservationStatuses();
    },
    { connection: redis }
  );

  const notificationWorker = new Worker(
    "notifications",
    async () => {
      const result = await deliverPendingPushNotifications();
      logger.debug(result, "Notification queue tick");
    },
    { connection: redis }
  );

  for (const worker of [reportWorker, notificationWorker]) {
    worker.on("failed", (job, error) => logger.error({ jobId: job?.id, err: error }, "Background job failed"));
  }

  return [reportWorker, notificationWorker];
}
