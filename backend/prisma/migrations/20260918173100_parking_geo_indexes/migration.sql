-- Apply outside a transaction: PostgreSQL does not permit CREATE INDEX
-- CONCURRENTLY in a transaction block.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ParkingSpot_geoPoint_gist" ON "ParkingSpot" USING GIST ("geoPoint");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ParkingSpot_id_public" ON "ParkingSpot" (id) WHERE "ownerId" IS NULL OR "verifiedAt" IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ParkingSpot_pending" ON "ParkingSpot" ("createdAt" DESC, id) WHERE "ownerId" IS NOT NULL AND "verifiedAt" IS NULL;
