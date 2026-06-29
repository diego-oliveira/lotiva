-- CreateTable
CREATE TABLE "DevelopmentMap" (
    "id" TEXT NOT NULL,
    "developmentId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "pdfPageNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentMap_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Lot"
ADD COLUMN "mapXPercent" DOUBLE PRECISION,
ADD COLUMN "mapYPercent" DOUBLE PRECISION;

-- CreateIndex
CREATE UNIQUE INDEX "DevelopmentMap_developmentId_key" ON "DevelopmentMap"("developmentId");

-- AddForeignKey
ALTER TABLE "DevelopmentMap" ADD CONSTRAINT "DevelopmentMap_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "Development"("id") ON DELETE CASCADE ON UPDATE CASCADE;
