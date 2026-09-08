import { Worker } from "bullmq";
import { logger } from "../config/logger.js";
import { redis } from "../database/redis.js";
import { prisma } from "../database/prisma.js";

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
    },
    { connection: redis }
  );

  const notificationWorker = new Worker(
    "notifications",
    async () => {
      logger.debug("Notification queue tick");
    },
    { connection: redis }
  );

  for (const worker of [reportWorker, notificationWorker]) {
    worker.on("failed", (job, error) => logger.error({ jobId: job?.id, err: error }, "Background job failed"));
  }

  return [reportWorker, notificationWorker];
}
