CREATE TABLE "ImpersonationSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpersonationSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImpersonationSession_tokenHash_key" ON "ImpersonationSession"("tokenHash");
CREATE INDEX "ImpersonationSession_actorId_expiresAt_idx" ON "ImpersonationSession"("actorId", "expiresAt");
CREATE INDEX "ImpersonationSession_targetId_expiresAt_idx" ON "ImpersonationSession"("targetId", "expiresAt");

ALTER TABLE "ImpersonationSession" ADD CONSTRAINT "ImpersonationSession_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImpersonationSession" ADD CONSTRAINT "ImpersonationSession_targetId_fkey"
FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
