CREATE TABLE "SaleParticipant" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'buyer',
  "relationshipType" TEXT NOT NULL DEFAULT 'independent',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SaleParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserRelationship" (
  "id" TEXT NOT NULL,
  "personAId" TEXT NOT NULL,
  "personBId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserRelationship_pkey" PRIMARY KEY ("id")
);

INSERT INTO "SaleParticipant" ("id", "saleId", "userId", "role", "relationshipType", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", "coBuyerId", 'buyer', 'independent', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Sale" WHERE "coBuyerId" IS NOT NULL;

CREATE UNIQUE INDEX "SaleParticipant_saleId_userId_key" ON "SaleParticipant"("saleId", "userId");
CREATE INDEX "SaleParticipant_userId_idx" ON "SaleParticipant"("userId");
CREATE UNIQUE INDEX "UserRelationship_personAId_personBId_type_key" ON "UserRelationship"("personAId", "personBId", "type");
CREATE INDEX "UserRelationship_personBId_idx" ON "UserRelationship"("personBId");

ALTER TABLE "SaleParticipant" ADD CONSTRAINT "SaleParticipant_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleParticipant" ADD CONSTRAINT "SaleParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserRelationship" ADD CONSTRAINT "UserRelationship_personAId_fkey" FOREIGN KEY ("personAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRelationship" ADD CONSTRAINT "UserRelationship_personBId_fkey" FOREIGN KEY ("personBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Proposal" DROP CONSTRAINT IF EXISTS "Proposal_coBuyerId_fkey";
DROP INDEX IF EXISTS "Proposal_coBuyerId_idx";
ALTER TABLE "Proposal" DROP COLUMN IF EXISTS "coBuyerId";

ALTER TABLE "Sale" DROP CONSTRAINT IF EXISTS "Sale_coBuyerId_fkey";
DROP INDEX IF EXISTS "Sale_coBuyerId_idx";
ALTER TABLE "Sale" DROP COLUMN IF EXISTS "coBuyerId";
