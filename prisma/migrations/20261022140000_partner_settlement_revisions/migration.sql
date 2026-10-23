-- CreateTable
CREATE TABLE "PartnerSettlementRevision" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "payments" JSONB NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerSettlementRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerSettlementRevision_settlementId_number_key" ON "PartnerSettlementRevision"("settlementId", "number");

-- AddForeignKey
ALTER TABLE "PartnerSettlementRevision" ADD CONSTRAINT "PartnerSettlementRevision_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "PartnerSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSettlementRevision" ADD CONSTRAINT "PartnerSettlementRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

