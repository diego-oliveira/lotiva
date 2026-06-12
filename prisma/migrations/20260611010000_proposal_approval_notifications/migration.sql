ALTER TABLE "Proposal"
ADD COLUMN "createdById" TEXT,
ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "exceptionReasons" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "rejectionReason" TEXT;

UPDATE "Proposal"
SET "createdById" = "userId"
WHERE "createdById" IS NULL;

ALTER TABLE "Proposal"
ALTER COLUMN "createdById" SET NOT NULL;

ALTER TABLE "Sale"
ADD COLUMN "proposalId" TEXT;

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Proposal_createdById_status_idx" ON "Proposal"("createdById", "status");
CREATE INDEX "Proposal_reviewedById_idx" ON "Proposal"("reviewedById");
CREATE INDEX "Proposal_status_createdAt_idx" ON "Proposal"("status", "createdAt");
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");
CREATE UNIQUE INDEX "Sale_proposalId_key" ON "Sale"("proposalId");

ALTER TABLE "Proposal"
ADD CONSTRAINT "Proposal_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Proposal"
ADD CONSTRAINT "Proposal_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_proposalId_fkey"
FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
