ALTER TABLE "Development"
ADD COLUMN "publicMapEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "publicMapToken" TEXT,
ADD COLUMN "publicMapShowPrices" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "Development_publicMapToken_key" ON "Development"("publicMapToken");

CREATE TABLE "PublicLotInterest" (
    "id" TEXT NOT NULL,
    "developmentId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicLotInterest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PublicLotInterest_developmentId_createdAt_idx" ON "PublicLotInterest"("developmentId", "createdAt");
CREATE INDEX "PublicLotInterest_lotId_status_createdAt_idx" ON "PublicLotInterest"("lotId", "status", "createdAt");
CREATE INDEX "PublicLotInterest_email_idx" ON "PublicLotInterest"("email");
CREATE INDEX "PublicLotInterest_phone_idx" ON "PublicLotInterest"("phone");

ALTER TABLE "PublicLotInterest"
ADD CONSTRAINT "PublicLotInterest_developmentId_fkey"
FOREIGN KEY ("developmentId") REFERENCES "Development"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PublicLotInterest"
ADD CONSTRAINT "PublicLotInterest_lotId_fkey"
FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
