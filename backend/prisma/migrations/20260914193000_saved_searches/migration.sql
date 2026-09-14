CREATE TABLE IF NOT EXISTS "SavedSearch" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "filters" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedSearch_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SavedSearch_userId_createdAt_idx" ON "SavedSearch"("userId", "createdAt");
