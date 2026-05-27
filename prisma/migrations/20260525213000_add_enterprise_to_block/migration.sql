-- AlterTable
ALTER TABLE "Block" ADD COLUMN "enterpriseId" TEXT;

-- AddForeignKey
ALTER TABLE "Block"
ADD CONSTRAINT "Block_enterpriseId_fkey"
FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
