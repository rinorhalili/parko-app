-- Authentication verification tokens and community report confirmations.
-- Additive migration: safe to deploy alongside existing production data.
CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailVerificationToken_tokenHash_key" UNIQUE ("tokenHash"),
  CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_userId_expiresAt_idx" ON "EmailVerificationToken"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

CREATE TABLE IF NOT EXISTS "ParkingReportVote" (
  "id" TEXT NOT NULL,
  "parkingReportId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "vote" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParkingReportVote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ParkingReportVote_parkingReportId_userId_key" UNIQUE ("parkingReportId", "userId"),
  CONSTRAINT "ParkingReportVote_parkingReportId_fkey" FOREIGN KEY ("parkingReportId") REFERENCES "ParkingReport"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ParkingReportVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ParkingReportVote_parkingReportId_vote_idx" ON "ParkingReportVote"("parkingReportId", "vote");
CREATE INDEX IF NOT EXISTS "ParkingReportVote_userId_createdAt_idx" ON "ParkingReportVote"("userId", "createdAt");
