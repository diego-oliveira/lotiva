ALTER TABLE "Contract"
ADD COLUMN "signatureProvider" TEXT,
ADD COLUMN "signatureDocumentId" TEXT,
ADD COLUMN "signatureStatus" TEXT,
ADD COLUMN "signatureSigners" JSONB,
ADD COLUMN "signatureSentAt" TIMESTAMP(3),
ADD COLUMN "signatureCompletedAt" TIMESTAMP(3),
ADD COLUMN "signatureSignedUrl" TEXT;

CREATE UNIQUE INDEX "Contract_signatureDocumentId_key" ON "Contract"("signatureDocumentId");
CREATE INDEX "Contract_signatureProvider_signatureStatus_idx" ON "Contract"("signatureProvider", "signatureStatus");
