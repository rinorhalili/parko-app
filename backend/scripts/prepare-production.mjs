import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";

const run = promisify(execFile);
const prisma = new PrismaClient();

try {
  await prisma.$connect();
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS postgis");
} finally {
  await prisma.$disconnect();
}

// The repository contains additive migrations without a historical baseline.
// A failed first boot can leave Prisma's migration ledger blocking startup;
// roll that specific bootstrap attempt back before syncing the schema.
await run("npx", [
  "prisma",
  "migrate",
  "resolve",
  "--rolled-back",
  "20260911221000_community_favorites_alerts_media",
], { stdio: "inherit" }).catch(() => undefined);

// Sync the fresh Render database from the checked-in schema first.
await run("npx", ["prisma", "db", "push", "--skip-generate"], { stdio: "inherit" });
await run("npm", ["run", "import:parking"], { stdio: "inherit" });
await run("node", ["dist/src/server.js"], { stdio: "inherit" });
