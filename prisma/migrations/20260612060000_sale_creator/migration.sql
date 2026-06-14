ALTER TABLE "Sale" ADD COLUMN "createdById" TEXT;

UPDATE "Sale" AS sale
SET "createdById" = COALESCE(
  (
    SELECT proposal."createdById"
    FROM "Proposal" AS proposal
    WHERE proposal."id" = sale."proposalId"
    LIMIT 1
  ),
  (
    SELECT event."userId"
    FROM "LotEvent" AS event
    WHERE event."lotId" = sale."lotId"
      AND event."type" = 'sale_created'
      AND event."userId" IS NOT NULL
    ORDER BY ABS(EXTRACT(EPOCH FROM (event."createdAt" - sale."createdAt"))) ASC
    LIMIT 1
  )
);

CREATE INDEX "Sale_createdById_createdAt_idx" ON "Sale"("createdById", "createdAt");

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
