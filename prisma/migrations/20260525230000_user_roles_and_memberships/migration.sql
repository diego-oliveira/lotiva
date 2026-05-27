-- Drop old foreign keys that still reference Client/customerId
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_customerId_fkey";
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_customerId_fkey";

-- Rename Client table to User
ALTER TABLE "Client" RENAME TO "User";
ALTER INDEX "Client_cpf_key" RENAME TO "User_cpf_key";
ALTER INDEX "Client_email_key" RENAME TO "User_email_key";

-- Rename customerId columns to userId
ALTER TABLE "Reservation" RENAME COLUMN "customerId" TO "userId";
ALTER TABLE "Sale" RENAME COLUMN "customerId" TO "userId";

-- Recreate foreign keys with the new names
ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterpriseUser" (
    "id" TEXT NOT NULL,
    "enterpriseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnterpriseUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterpriseUserRole" (
    "id" TEXT NOT NULL,
    "enterpriseUserId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnterpriseUserRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EnterpriseUser_enterpriseId_userId_key" ON "EnterpriseUser"("enterpriseId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EnterpriseUserRole_enterpriseUserId_roleId_key" ON "EnterpriseUserRole"("enterpriseUserId", "roleId");

-- AddForeignKey
ALTER TABLE "EnterpriseUser"
ADD CONSTRAINT "EnterpriseUser_enterpriseId_fkey"
FOREIGN KEY ("enterpriseId") REFERENCES "Enterprise"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseUser"
ADD CONSTRAINT "EnterpriseUser_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseUserRole"
ADD CONSTRAINT "EnterpriseUserRole_enterpriseUserId_fkey"
FOREIGN KEY ("enterpriseUserId") REFERENCES "EnterpriseUser"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnterpriseUserRole"
ADD CONSTRAINT "EnterpriseUserRole_roleId_fkey"
FOREIGN KEY ("roleId") REFERENCES "Role"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
