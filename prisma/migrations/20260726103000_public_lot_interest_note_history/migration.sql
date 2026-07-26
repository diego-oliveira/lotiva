CREATE TABLE "PublicLotInterestNote" (
    "id" TEXT NOT NULL,
    "interestId" TEXT NOT NULL,
    "userId" TEXT,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicLotInterestNote_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PublicLotInterestNote" ("id", "interestId", "userId", "note", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || "id"), "id", NULL, "internalNotes", "updatedAt"
FROM "PublicLotInterest"
WHERE "internalNotes" IS NOT NULL AND length(trim("internalNotes")) > 0;

CREATE INDEX "PublicLotInterestNote_interestId_createdAt_idx" ON "PublicLotInterestNote"("interestId", "createdAt");
CREATE INDEX "PublicLotInterestNote_userId_idx" ON "PublicLotInterestNote"("userId");

ALTER TABLE "PublicLotInterestNote"
ADD CONSTRAINT "PublicLotInterestNote_interestId_fkey"
FOREIGN KEY ("interestId") REFERENCES "PublicLotInterest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PublicLotInterestNote"
ADD CONSTRAINT "PublicLotInterestNote_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
