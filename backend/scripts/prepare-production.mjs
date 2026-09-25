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
// Sync the fresh Render database from the checked-in schema first; later
// additive migrations remain available for environments with a baseline.
await run("npx", ["prisma", "db", "push", "--skip-generate"], { stdio: "inherit" });
await run("npm", ["run", "import:parking"], { stdio: "inherit" });
await run("node", ["dist/src/server.js"], { stdio: "inherit" });
