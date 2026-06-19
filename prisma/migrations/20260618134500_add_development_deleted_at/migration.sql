-- AlterTable
ALTER TABLE "Development" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Development_deletedAt_idx" ON "Development"("deletedAt");
