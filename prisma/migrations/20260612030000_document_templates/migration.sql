CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'contract',
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "content" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplateVersion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Development" ADD COLUMN "documentTemplateId" TEXT;
ALTER TABLE "Contract" ADD COLUMN "documentTemplateVersionId" TEXT;

CREATE INDEX "DocumentTemplate_companyId_type_status_idx" ON "DocumentTemplate"("companyId", "type", "status");
CREATE UNIQUE INDEX "DocumentTemplateVersion_templateId_version_key" ON "DocumentTemplateVersion"("templateId", "version");
CREATE INDEX "DocumentTemplateVersion_templateId_status_version_idx" ON "DocumentTemplateVersion"("templateId", "status", "version");
CREATE INDEX "Development_documentTemplateId_idx" ON "Development"("documentTemplateId");
CREATE INDEX "Contract_documentTemplateVersionId_idx" ON "Contract"("documentTemplateVersionId");

ALTER TABLE "DocumentTemplate"
ADD CONSTRAINT "DocumentTemplate_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentTemplate"
ADD CONSTRAINT "DocumentTemplate_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DocumentTemplateVersion"
ADD CONSTRAINT "DocumentTemplateVersion_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentTemplateVersion"
ADD CONSTRAINT "DocumentTemplateVersion_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Development"
ADD CONSTRAINT "Development_documentTemplateId_fkey"
FOREIGN KEY ("documentTemplateId") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Contract"
ADD CONSTRAINT "Contract_documentTemplateVersionId_fkey"
FOREIGN KEY ("documentTemplateVersionId") REFERENCES "DocumentTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
