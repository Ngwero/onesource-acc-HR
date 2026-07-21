-- AlterTable
ALTER TABLE "CompanySetting" ADD COLUMN IF NOT EXISTS "sessionIdleMinutes" INTEGER NOT NULL DEFAULT 15;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CollectionFollowUp" (
    "id" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'PHONE',
    "nextFollowUpAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CollectionFollowUp_receivableId_idx" ON "CollectionFollowUp"("receivableId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CollectionFollowUp_nextFollowUpAt_idx" ON "CollectionFollowUp"("nextFollowUpAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CollectionFollowUp_createdById_idx" ON "CollectionFollowUp"("createdById");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CollectionFollowUp" ADD CONSTRAINT "CollectionFollowUp_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "Receivable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CollectionFollowUp" ADD CONSTRAINT "CollectionFollowUp_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
