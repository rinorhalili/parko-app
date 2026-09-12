import { prisma } from "../database/prisma.js";
import { redis } from "../database/redis.js";
import { env } from "../config/env.js";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))
  ]);
}

export async function healthStatus() {
  const [database, cache] = await Promise.allSettled([
    withTimeout(prisma.$queryRaw`SELECT 1`, 2000),
    withTimeout(redis.ping(), 2000)
  ]);
  const healthy = database.status === "fulfilled" && cache.status === "fulfilled";
  return { healthy, status: healthy ? "ok" : "degraded", uptime: Math.floor(process.uptime()), environment: env.NODE_ENV, version: process.env.npm_package_version ?? "0.1.0", dependencies: { database: database.status === "fulfilled" ? "up" : "down", redis: cache.status === "fulfilled" ? "up" : "down" } };
}
