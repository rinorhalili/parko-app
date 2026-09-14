-- Adds lightweight metadata tables for zone browsing and saved text search.
CREATE TABLE IF NOT EXISTS "ParkingZone" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "centerLatitude" DOUBLE PRECISION,
  "centerLongitude" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ParkingSpot_zone_idx" ON "ParkingSpot"("zone");
CREATE INDEX IF NOT EXISTS "ParkingSpot_title_address_zone_idx" ON "ParkingSpot"("title", "address", "zone");
