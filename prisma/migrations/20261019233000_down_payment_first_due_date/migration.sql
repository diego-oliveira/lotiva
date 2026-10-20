ALTER TABLE "Proposal" ADD COLUMN "downPaymentFirstDueDate" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN "downPaymentFirstDueDate" TIMESTAMP(3);

UPDATE "Proposal"
SET "downPaymentFirstDueDate" = "createdAt"
WHERE "downPayment" > 0;

UPDATE "Sale"
SET "downPaymentFirstDueDate" = "createdAt"
WHERE "downPayment" > 0;
