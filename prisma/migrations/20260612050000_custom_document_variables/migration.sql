CREATE TABLE "DocumentVariable" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentVariable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DevelopmentDocumentValue" (
    "id" TEXT NOT NULL,
    "developmentId" TEXT NOT NULL,
    "variableId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentDocumentValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentVariable_companyId_key_key" ON "DocumentVariable"("companyId", "key");
CREATE INDEX "DocumentVariable_companyId_idx" ON "DocumentVariable"("companyId");
CREATE UNIQUE INDEX "DevelopmentDocumentValue_developmentId_variableId_key" ON "DevelopmentDocumentValue"("developmentId", "variableId");
CREATE INDEX "DevelopmentDocumentValue_variableId_idx" ON "DevelopmentDocumentValue"("variableId");

ALTER TABLE "DocumentVariable"
ADD CONSTRAINT "DocumentVariable_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DevelopmentDocumentValue"
ADD CONSTRAINT "DevelopmentDocumentValue_developmentId_fkey"
FOREIGN KEY ("developmentId") REFERENCES "Development"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DevelopmentDocumentValue"
ADD CONSTRAINT "DevelopmentDocumentValue_variableId_fkey"
FOREIGN KEY ("variableId") REFERENCES "DocumentVariable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
