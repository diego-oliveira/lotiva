ALTER TABLE "DevelopmentSettings"
ADD COLUMN "allowDownPaymentInstallments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "maxDownPaymentInstallments" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Proposal"
ADD COLUMN "downPaymentInstallmentCount" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Sale"
ADD COLUMN "coBuyerId" TEXT,
ADD COLUMN "downPaymentInstallmentCount" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "Sale_coBuyerId_idx" ON "Sale"("coBuyerId");

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_coBuyerId_fkey"
FOREIGN KEY ("coBuyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
