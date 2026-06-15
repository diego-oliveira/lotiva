ALTER TABLE "Contract"
ADD COLUMN "docxPath" TEXT,
ADD COLUMN "pdfPath" TEXT;

ALTER TABLE "DocumentTemplateVersion"
ADD COLUMN "filePath" TEXT,
ADD COLUMN "fileName" TEXT,
ADD COLUMN "fileHash" TEXT,
ADD COLUMN "variables" JSONB;

DELETE FROM "Contract";
DELETE FROM "DocumentTemplateVersion";
DELETE FROM "DocumentTemplate";

ALTER TABLE "Contract"
ALTER COLUMN "docxPath" SET NOT NULL,
DROP COLUMN "content";

ALTER TABLE "DocumentTemplateVersion"
ALTER COLUMN "filePath" SET NOT NULL,
ALTER COLUMN "fileName" SET NOT NULL,
ALTER COLUMN "fileHash" SET NOT NULL,
ALTER COLUMN "variables" SET NOT NULL,
DROP COLUMN "content";
