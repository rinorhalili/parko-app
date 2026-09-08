import { logger } from "./config/logger.js";
import { prisma } from "./database/prisma.js";
import { redis } from "./database/redis.js";
import { scheduleRecurringJobs } from "./jobs/queues.js";
import { startWorkers } from "./jobs/workers.js";

await prisma.$connect();
await redis.ping();
await scheduleRecurringJobs();
const workers = startWorkers();
logger.info("Parko background worker started");

const shutdown = async () => {
  logger.info("Shutting down background worker");
  await Promise.all(workers.map((worker) => worker.close()));
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
