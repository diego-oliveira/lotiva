ALTER TABLE "DevelopmentSettings"
ADD COLUMN "defaultCommissionPercentage" DOUBLE PRECISION NOT NULL DEFAULT 6;

CREATE TABLE "SaleCommission" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "percentage" DECIMAL(7,4) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting_entry',
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SaleCommission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionPayment" (
    "id" TEXT NOT NULL,
    "commissionId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "pixKey" TEXT,
    "notes" TEXT,
    "proofUrl" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommissionPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SaleCommission_saleId_userId_key" ON "SaleCommission"("saleId", "userId");
CREATE INDEX "SaleCommission_userId_status_idx" ON "SaleCommission"("userId", "status");
CREATE INDEX "SaleCommission_status_createdAt_idx" ON "SaleCommission"("status", "createdAt");
CREATE INDEX "CommissionPayment_commissionId_paidAt_idx" ON "CommissionPayment"("commissionId", "paidAt");
CREATE INDEX "CommissionPayment_createdById_idx" ON "CommissionPayment"("createdById");

ALTER TABLE "SaleCommission" ADD CONSTRAINT "SaleCommission_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleCommission" ADD CONSTRAINT "SaleCommission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "SaleCommission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommissionPayment" ADD CONSTRAINT "CommissionPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
