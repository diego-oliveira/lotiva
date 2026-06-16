ALTER TABLE "PaymentProviderConnection"
ADD COLUMN "webhookId" TEXT,
ADD COLUMN "webhookUrl" TEXT,
ADD COLUMN "webhookStatus" TEXT DEFAULT 'not_configured',
ADD COLUMN "webhookAuthCiphertext" TEXT,
ADD COLUMN "webhookAuthHint" TEXT,
ADD COLUMN "lastWebhookAt" TIMESTAMP(3);

ALTER TABLE "PaymentWebhookEvent" ADD COLUMN "nextAttemptAt" TIMESTAMP(3);

ALTER TABLE "ExternalCharge"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "grossPaidAmount" DECIMAL(15,2),
ADD COLUMN "netPaidAmount" DECIMAL(15,2),
ADD COLUMN "feeAmount" DECIMAL(15,2),
ADD COLUMN "providerPaymentDate" TIMESTAMP(3),
ADD COLUMN "providerCreditDate" TIMESTAMP(3),
ADD COLUMN "lastEventAt" TIMESTAMP(3),
ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "cancelledById" TEXT;

ALTER TABLE "Notification" ADD COLUMN "deduplicationKey" TEXT;

DROP INDEX "BillingCycle_saleId_cycleNumber_key";
ALTER TABLE "BillingCycle" ADD COLUMN "adjustmentReviewId" TEXT;

CREATE TABLE "AdjustmentReview" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "indexName" TEXT NOT NULL,
    "percentage" DECIMAL(8,4) NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdjustmentReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdjustmentReviewItem" (
    "id" TEXT NOT NULL,
    "adjustmentReviewId" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "previousAmount" DECIMAL(15,2) NOT NULL,
    "adjustedAmount" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdjustmentReviewItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReconciliationRun" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "trigger" TEXT NOT NULL DEFAULT 'scheduled',
    "checkedCount" INTEGER NOT NULL DEFAULT 0,
    "divergenceCount" INTEGER NOT NULL DEFAULT 0,
    "resolvedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReconciliationDivergence" (
    "id" TEXT NOT NULL,
    "reconciliationRunId" TEXT NOT NULL,
    "externalChargeId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'detected',
    "localValue" JSONB,
    "providerValue" JSONB,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReconciliationDivergence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialAuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "saleId" TEXT,
    "receivableId" TEXT,
    "externalChargeId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingCycle_connectionId_saleId_cycleNumber_key" ON "BillingCycle"("connectionId", "saleId", "cycleNumber");
CREATE INDEX "BillingCycle_adjustmentReviewId_idx" ON "BillingCycle"("adjustmentReviewId");
CREATE UNIQUE INDEX "AdjustmentReview_connectionId_saleId_cycleNumber_key" ON "AdjustmentReview"("connectionId", "saleId", "cycleNumber");
CREATE INDEX "AdjustmentReview_status_createdAt_idx" ON "AdjustmentReview"("status", "createdAt");
CREATE UNIQUE INDEX "AdjustmentReviewItem_adjustmentReviewId_receivableId_key" ON "AdjustmentReviewItem"("adjustmentReviewId", "receivableId");
CREATE INDEX "AdjustmentReviewItem_receivableId_idx" ON "AdjustmentReviewItem"("receivableId");
CREATE INDEX "ReconciliationRun_connectionId_startedAt_idx" ON "ReconciliationRun"("connectionId", "startedAt");
CREATE INDEX "ReconciliationRun_status_startedAt_idx" ON "ReconciliationRun"("status", "startedAt");
CREATE INDEX "ReconciliationDivergence_status_createdAt_idx" ON "ReconciliationDivergence"("status", "createdAt");
CREATE INDEX "ReconciliationDivergence_externalChargeId_idx" ON "ReconciliationDivergence"("externalChargeId");
CREATE INDEX "FinancialAuditLog_companyId_createdAt_idx" ON "FinancialAuditLog"("companyId", "createdAt");
CREATE INDEX "FinancialAuditLog_entityType_entityId_idx" ON "FinancialAuditLog"("entityType", "entityId");
CREATE INDEX "FinancialAuditLog_saleId_createdAt_idx" ON "FinancialAuditLog"("saleId", "createdAt");
CREATE INDEX "PaymentWebhookEvent_status_nextAttemptAt_idx" ON "PaymentWebhookEvent"("status", "nextAttemptAt");
CREATE UNIQUE INDEX "Notification_deduplicationKey_key" ON "Notification"("deduplicationKey");

ALTER TABLE "BillingCycle" ADD CONSTRAINT "BillingCycle_adjustmentReviewId_fkey" FOREIGN KEY ("adjustmentReviewId") REFERENCES "AdjustmentReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdjustmentReview" ADD CONSTRAINT "AdjustmentReview_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "PaymentProviderConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdjustmentReview" ADD CONSTRAINT "AdjustmentReview_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdjustmentReview" ADD CONSTRAINT "AdjustmentReview_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdjustmentReview" ADD CONSTRAINT "AdjustmentReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdjustmentReviewItem" ADD CONSTRAINT "AdjustmentReviewItem_adjustmentReviewId_fkey" FOREIGN KEY ("adjustmentReviewId") REFERENCES "AdjustmentReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdjustmentReviewItem" ADD CONSTRAINT "AdjustmentReviewItem_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "Receivable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReconciliationRun" ADD CONSTRAINT "ReconciliationRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "PaymentProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReconciliationDivergence" ADD CONSTRAINT "ReconciliationDivergence_reconciliationRunId_fkey" FOREIGN KEY ("reconciliationRunId") REFERENCES "ReconciliationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialAuditLog" ADD CONSTRAINT "FinancialAuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialAuditLog" ADD CONSTRAINT "FinancialAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
