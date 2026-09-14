CREATE TABLE IF NOT EXISTS "ParkingOccupancyHistory" (
  "id" TEXT PRIMARY KEY,
  "parkingSpotId" TEXT NOT NULL,
  "status" "ParkingStatus" NOT NULL,
  "availableSpaces" INTEGER,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParkingOccupancyHistory_parkingSpotId_fkey"
    FOREIGN KEY ("parkingSpotId") REFERENCES "ParkingSpot"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ParkingOccupancyHistory_parkingSpotId_observedAt_idx"
  ON "ParkingOccupancyHistory"("parkingSpotId", "observedAt");
