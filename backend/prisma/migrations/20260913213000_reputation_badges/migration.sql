CREATE TABLE IF NOT EXISTS "UserBadge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserBadge_userId_code_key" UNIQUE ("userId", "code"),
  CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "UserBadge_userId_awardedAt_idx" ON "UserBadge"("userId", "awardedAt");
