-- CreateTable
CREATE TABLE "LotEvent" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LotEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LotEvent_lotId_createdAt_idx" ON "LotEvent"("lotId", "createdAt");

-- CreateIndex
CREATE INDEX "LotEvent_type_idx" ON "LotEvent"("type");

-- AddForeignKey
ALTER TABLE "LotEvent" ADD CONSTRAINT "LotEvent_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotEvent" ADD CONSTRAINT "LotEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
