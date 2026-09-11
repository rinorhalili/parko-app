-- Community favorites and alert subscriptions. This migration is additive only.
ALTER TABLE "ParkingReport" ADD COLUMN IF NOT EXISTS "media" JSONB;

CREATE TABLE IF NOT EXISTS "FavoriteParking" (
  "userId" TEXT NOT NULL,
  "parkingSpotId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FavoriteParking_pkey" PRIMARY KEY ("userId", "parkingSpotId"),
  CONSTRAINT "FavoriteParking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FavoriteParking_parkingSpotId_fkey" FOREIGN KEY ("parkingSpotId") REFERENCES "ParkingSpot"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "FavoriteParking_parkingSpotId_createdAt_idx" ON "FavoriteParking"("parkingSpotId", "createdAt");

CREATE TABLE IF NOT EXISTS "FavoritePost" (
  "userId" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FavoritePost_pkey" PRIMARY KEY ("userId", "postId"),
  CONSTRAINT "FavoritePost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FavoritePost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "FavoritePost_postId_createdAt_idx" ON "FavoritePost"("postId", "createdAt");

CREATE TABLE IF NOT EXISTS "ZoneAlert" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "zone" TEXT NOT NULL,
  "lastNotifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ZoneAlert_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ZoneAlert_userId_zone_key" UNIQUE ("userId", "zone"),
  CONSTRAINT "ZoneAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ZoneAlert_zone_lastNotifiedAt_idx" ON "ZoneAlert"("zone", "lastNotifiedAt");
