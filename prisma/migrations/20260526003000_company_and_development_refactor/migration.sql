-- Create the legal company table
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- Seed a default company so existing empreendimento records can be linked
INSERT INTO "Company" ("id", "name", "logo", "createdAt", "updatedAt")
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Empresa Padrão',
    'https://placehold.co/240x120?text=Empresa',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Rename empreendimento table
ALTER TABLE "Enterprise" RENAME TO "Development";

-- Block relation becomes developmentId
ALTER TABLE "Block" DROP CONSTRAINT "Block_enterpriseId_fkey";
ALTER TABLE "Block" RENAME COLUMN "enterpriseId" TO "developmentId";

-- Membership tables become development-scoped
ALTER TABLE "EnterpriseUser" DROP CONSTRAINT "EnterpriseUser_enterpriseId_fkey";
ALTER TABLE "EnterpriseUser" DROP CONSTRAINT "EnterpriseUser_userId_fkey";
ALTER TABLE "EnterpriseUserRole" DROP CONSTRAINT "EnterpriseUserRole_enterpriseUserId_fkey";
ALTER TABLE "EnterpriseUserRole" DROP CONSTRAINT "EnterpriseUserRole_roleId_fkey";

ALTER TABLE "EnterpriseUser" RENAME TO "DevelopmentUser";
ALTER TABLE "EnterpriseUserRole" RENAME TO "DevelopmentUserRole";

ALTER TABLE "DevelopmentUser" RENAME COLUMN "enterpriseId" TO "developmentId";
ALTER TABLE "DevelopmentUserRole" RENAME COLUMN "enterpriseUserId" TO "developmentUserId";

-- Add company ownership to developments
ALTER TABLE "Development"
ADD COLUMN "companyId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';

-- Rename indexes to match new table names
ALTER INDEX "EnterpriseUser_enterpriseId_userId_key" RENAME TO "DevelopmentUser_developmentId_userId_key";
ALTER INDEX "EnterpriseUserRole_enterpriseUserId_roleId_key" RENAME TO "DevelopmentUserRole_developmentUserId_roleId_key";

-- Recreate foreign keys with new semantics
ALTER TABLE "Block"
ADD CONSTRAINT "Block_developmentId_fkey"
FOREIGN KEY ("developmentId") REFERENCES "Development"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "Development"
ADD CONSTRAINT "Development_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "DevelopmentUser"
ADD CONSTRAINT "DevelopmentUser_developmentId_fkey"
FOREIGN KEY ("developmentId") REFERENCES "Development"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "DevelopmentUser"
ADD CONSTRAINT "DevelopmentUser_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "DevelopmentUserRole"
ADD CONSTRAINT "DevelopmentUserRole_developmentUserId_fkey"
FOREIGN KEY ("developmentUserId") REFERENCES "DevelopmentUser"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "DevelopmentUserRole"
ADD CONSTRAINT "DevelopmentUserRole_roleId_fkey"
FOREIGN KEY ("roleId") REFERENCES "Role"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
