ALTER TABLE "DocumentTemplate"
ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'sale_contract';

DROP INDEX "DocumentTemplate_companyId_type_status_idx";
CREATE INDEX "DocumentTemplate_companyId_type_purpose_status_idx"
ON "DocumentTemplate"("companyId", "type", "purpose", "status");
