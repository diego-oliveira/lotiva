CREATE TABLE "PaymentProviderConnection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "credentialCiphertext" TEXT,
    "credentialHint" TEXT,
    "lastValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentProviderConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalCustomer" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerCustomerId" TEXT NOT NULL,
    "externalReference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSynchronizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalCustomer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingCycle" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "startSequence" INTEGER NOT NULL,
    "endSequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingCycle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalCharge" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "billingCycleId" TEXT,
    "receivableId" TEXT NOT NULL,
    "providerChargeId" TEXT NOT NULL,
    "externalReference" TEXT NOT NULL,
    "billingType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "invoiceUrl" TEXT,
    "bankSlipUrl" TEXT,
    "pixPayload" TEXT,
    "pixEncodedImage" TEXT,
    "providerPayload" JSONB,
    "cancelledAt" TIMESTAMP(3),
    "lastSynchronizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExternalCharge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentProviderConnection_companyId_provider_environment_key"
ON "PaymentProviderConnection"("companyId", "provider", "environment");
CREATE INDEX "PaymentProviderConnection_companyId_status_idx"
ON "PaymentProviderConnection"("companyId", "status");

CREATE UNIQUE INDEX "ExternalCustomer_connectionId_userId_key"
ON "ExternalCustomer"("connectionId", "userId");
CREATE UNIQUE INDEX "ExternalCustomer_connectionId_providerCustomerId_key"
ON "ExternalCustomer"("connectionId", "providerCustomerId");
CREATE UNIQUE INDEX "ExternalCustomer_connectionId_externalReference_key"
ON "ExternalCustomer"("connectionId", "externalReference");

CREATE UNIQUE INDEX "BillingCycle_saleId_cycleNumber_key"
ON "BillingCycle"("saleId", "cycleNumber");
CREATE INDEX "BillingCycle_connectionId_status_idx"
ON "BillingCycle"("connectionId", "status");

CREATE UNIQUE INDEX "ExternalCharge_connectionId_providerChargeId_key"
ON "ExternalCharge"("connectionId", "providerChargeId");
CREATE UNIQUE INDEX "ExternalCharge_connectionId_externalReference_key"
ON "ExternalCharge"("connectionId", "externalReference");
CREATE INDEX "ExternalCharge_receivableId_status_idx"
ON "ExternalCharge"("receivableId", "status");
CREATE INDEX "ExternalCharge_billingCycleId_idx"
ON "ExternalCharge"("billingCycleId");

CREATE UNIQUE INDEX "PaymentWebhookEvent_connectionId_providerEventId_key"
ON "PaymentWebhookEvent"("connectionId", "providerEventId");
CREATE INDEX "PaymentWebhookEvent_status_createdAt_idx"
ON "PaymentWebhookEvent"("status", "createdAt");

ALTER TABLE "PaymentProviderConnection"
ADD CONSTRAINT "PaymentProviderConnection_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalCustomer"
ADD CONSTRAINT "ExternalCustomer_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "PaymentProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalCustomer"
ADD CONSTRAINT "ExternalCustomer_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingCycle"
ADD CONSTRAINT "BillingCycle_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "PaymentProviderConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingCycle"
ADD CONSTRAINT "BillingCycle_saleId_fkey"
FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalCharge"
ADD CONSTRAINT "ExternalCharge_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "PaymentProviderConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalCharge"
ADD CONSTRAINT "ExternalCharge_billingCycleId_fkey"
FOREIGN KEY ("billingCycleId") REFERENCES "BillingCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExternalCharge"
ADD CONSTRAINT "ExternalCharge_receivableId_fkey"
FOREIGN KEY ("receivableId") REFERENCES "Receivable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentWebhookEvent"
ADD CONSTRAINT "PaymentWebhookEvent_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "PaymentProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
