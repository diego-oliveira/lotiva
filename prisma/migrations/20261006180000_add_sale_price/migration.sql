ALTER TABLE "Sale" ADD COLUMN "salePrice" DECIMAL(15,2);

UPDATE "Sale" AS sale
SET "salePrice" = COALESCE(
  (SELECT proposal."salePrice" FROM "Proposal" AS proposal WHERE proposal."id" = sale."proposalId"),
  (SELECT lot."price" FROM "Lot" AS lot WHERE lot."id" = sale."lotId"),
  sale."totalValue"
);

ALTER TABLE "Sale" ALTER COLUMN "salePrice" SET NOT NULL;
