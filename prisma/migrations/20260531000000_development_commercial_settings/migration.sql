CREATE TABLE "DevelopmentSettings" (
    "id" TEXT NOT NULL,
    "developmentId" TEXT NOT NULL,
    "reservationValidityDays" INTEGER NOT NULL DEFAULT 7,
    "defaultInterestRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "interestCalculation" TEXT NOT NULL DEFAULT 'none',
    "correctionIndex" TEXT NOT NULL DEFAULT 'none',
    "correctionFrequency" TEXT NOT NULL DEFAULT 'monthly',
    "minDownPaymentPercentage" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "maxInstallments" INTEGER NOT NULL DEFAULT 120,
    "paymentMethods" TEXT NOT NULL DEFAULT 'cash,installments',
    "allowCustomTerms" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DevelopmentSettings_developmentId_key" ON "DevelopmentSettings"("developmentId");

ALTER TABLE "DevelopmentSettings"
ADD CONSTRAINT "DevelopmentSettings_developmentId_fkey"
FOREIGN KEY ("developmentId") REFERENCES "Development"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
