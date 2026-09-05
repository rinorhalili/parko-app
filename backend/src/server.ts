import { createServer } from "node:http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { prisma } from "./database/prisma.js";
import { redis } from "./database/redis.js";
import { createApp } from "./app.js";
import { scheduleRecurringJobs } from "./jobs/queues.js";
import { startWorkers } from "./jobs/workers.js";
import { createSocketServer } from "./websocket/index.js";

const app = createApp();
const server = createServer(app);
createSocketServer(server);

await prisma.$connect();
await redis.ping();
await scheduleRecurringJobs();
const workers = startWorkers();

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "Community parking backend started");
});

const shutdown = async () => {
  logger.info("Shutting down backend");
  server.close();
  await Promise.all(workers.map((worker) => worker.close()));
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
