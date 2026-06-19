ALTER TABLE "Company" ADD COLUMN "createdById" TEXT;

UPDATE "Company"
SET "createdById" = creator."userId"
FROM (
  SELECT DISTINCT ON ("companyId") "companyId", "userId"
  FROM "CompanyUser"
  ORDER BY "companyId", "createdAt" ASC
) creator
WHERE "Company"."id" = creator."companyId";

DELETE FROM "CompanyUserRole"
WHERE "companyUserId" IN (
  SELECT "CompanyUser"."id"
  FROM "CompanyUser"
  INNER JOIN "Company" ON "Company"."id" = "CompanyUser"."companyId"
  WHERE "Company"."createdById" = "CompanyUser"."userId"
);

DELETE FROM "CompanyUser"
USING "Company"
WHERE "Company"."id" = "CompanyUser"."companyId"
  AND "Company"."createdById" = "CompanyUser"."userId";

ALTER TABLE "Company" ADD CONSTRAINT "Company_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Company_createdById_idx" ON "Company"("createdById");
