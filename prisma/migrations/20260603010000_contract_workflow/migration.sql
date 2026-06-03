CREATE TABLE "DevelopmentContractSettings" (
    "id" TEXT NOT NULL,
    "developmentId" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL DEFAULT '',
    "sellerDocument" TEXT NOT NULL DEFAULT '',
    "sellerAddress" TEXT NOT NULL DEFAULT '',
    "sellerRepresentatives" TEXT NOT NULL DEFAULT '',
    "propertyDescription" TEXT NOT NULL DEFAULT '',
    "acquisitionDescription" TEXT NOT NULL DEFAULT '',
    "paymentInstructions" TEXT NOT NULL DEFAULT '',
    "jurisdiction" TEXT NOT NULL DEFAULT '',
    "additionalClauses" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentContractSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DevelopmentContractSettings_developmentId_key" ON "DevelopmentContractSettings"("developmentId");

ALTER TABLE "DevelopmentContractSettings"
ADD CONSTRAINT "DevelopmentContractSettings_developmentId_fkey"
FOREIGN KEY ("developmentId") REFERENCES "Development"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Contract"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'generated',
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "lastRegenerationReason" TEXT;

CREATE TABLE "ContractEvent" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContractEvent_contractId_createdAt_idx" ON "ContractEvent"("contractId", "createdAt");
CREATE INDEX "ContractEvent_type_idx" ON "ContractEvent"("type");

ALTER TABLE "ContractEvent"
ADD CONSTRAINT "ContractEvent_contractId_fkey"
FOREIGN KEY ("contractId") REFERENCES "Contract"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
