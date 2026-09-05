import { Queue } from "bullmq";
import { redis } from "../database/redis.js";

export const reportExpirationQueue = new Queue("report-expiration", { connection: redis });
export const notificationQueue = new Queue("notifications", { connection: redis });

export async function scheduleRecurringJobs() {
  await reportExpirationQueue.upsertJobScheduler("expire-parking-reports", { every: 60_000 });
  await notificationQueue.upsertJobScheduler("process-notifications", { every: 30_000 });
}
