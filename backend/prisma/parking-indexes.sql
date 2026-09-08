-- Apply after the existing Prisma schema has been provisioned, outside a transaction.
-- Concurrent indexes avoid blocking normal parking reads/writes.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ParkingSpot_geoPoint_gist" ON "ParkingSpot" USING GIST ("geoPoint");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ParkingSpot_id_public" ON "ParkingSpot" (id) WHERE "ownerId" IS NULL OR "verifiedAt" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ParkingSpot_pending" ON "ParkingSpot" ("createdAt" DESC, id) WHERE "ownerId" IS NOT NULL AND "verifiedAt" IS NULL;
