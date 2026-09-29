import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let hasBaseSchema = false;

try {
  await prisma.$connect();
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS postgis");
  const rows = await prisma.$queryRawUnsafe(`SELECT to_regclass('public."User"')::text AS table_name`);
  hasBaseSchema = Boolean(rows[0]?.table_name);
} finally {
  await prisma.$disconnect();
}

// Render's existing database may not have a Prisma migration ledger because
// it predates the checked-in migration history. Sync the schema directly so
// startup does not fail while trying to resolve a migration that is unknown
// to that database. db push does not reset existing data unless explicitly
// requested with --force-reset.
const schemaArgs = hasBaseSchema
  ? ["prisma", "db", "push", "--skip-generate"]
  : ["prisma", "db", "push", "--force-reset", "--skip-generate"];
execFileSync("npx", schemaArgs, { stdio: "inherit" });
execFileSync("npm", ["run", "import:parking"], { stdio: "inherit" });
execFileSync("node", ["dist/src/server.js"], { stdio: "inherit" });
