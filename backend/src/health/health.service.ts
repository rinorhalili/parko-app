import { prisma } from "../database/prisma.js";
import { redis } from "../database/redis.js";
import { env } from "../config/env.js";

export async function healthStatus() {
  const [database, cache] = await Promise.allSettled([prisma.$queryRaw`SELECT 1`, redis.ping()]);
  const healthy = database.status === "fulfilled" && cache.status === "fulfilled";
  return { healthy, status: healthy ? "ok" : "degraded", uptime: Math.floor(process.uptime()), environment: env.NODE_ENV, version: process.env.npm_package_version ?? "0.1.0", dependencies: { database: database.status === "fulfilled" ? "up" : "down", redis: cache.status === "fulfilled" ? "up" : "down" } };
}
