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

await run("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit" });
await run("npm", ["run", "import:parking"], { stdio: "inherit" });
await run("node", ["dist/src/server.js"], { stdio: "inherit" });
