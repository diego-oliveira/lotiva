-- CreateTable
CREATE TABLE "PartnerAgreement" (
    "id" TEXT NOT NULL,
    "developmentId" TEXT NOT NULL,
    "partnerName" TEXT NOT NULL,
    "pixKey" TEXT NOT NULL DEFAULT '',
    "percentage" DECIMAL(7,4) NOT NULL,
    "recurringCosts" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerSettlement" (
    "id" TEXT NOT NULL,
    "developmentId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "partnerName" TEXT NOT NULL,
    "pixKey" TEXT NOT NULL DEFAULT '',
    "percentage" DECIMAL(7,4) NOT NULL,
    "expenses" JSONB NOT NULL DEFAULT '[]',
    "adjustments" JSONB NOT NULL DEFAULT '[]',
    "snapshot" JSONB,
    "receiptsTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "commissionsTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "costsTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "adjustmentsTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "partnerAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerPayment" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "proofUrl" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerAgreement_developmentId_key" ON "PartnerAgreement"("developmentId");

-- CreateIndex
CREATE INDEX "PartnerSettlement_developmentId_status_month_idx" ON "PartnerSettlement"("developmentId", "status", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerSettlement_developmentId_month_key" ON "PartnerSettlement"("developmentId", "month");

-- CreateIndex
CREATE INDEX "PartnerPayment_settlementId_paidAt_idx" ON "PartnerPayment"("settlementId", "paidAt");

-- AddForeignKey
ALTER TABLE "PartnerAgreement" ADD CONSTRAINT "PartnerAgreement_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "Development"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSettlement" ADD CONSTRAINT "PartnerSettlement_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "Development"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSettlement" ADD CONSTRAINT "PartnerSettlement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSettlement" ADD CONSTRAINT "PartnerSettlement_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayment" ADD CONSTRAINT "PartnerPayment_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "PartnerSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayment" ADD CONSTRAINT "PartnerPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

