CREATE TABLE "ReceivableContactLog" (
    "id" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceivableContactLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReceivableContactLog_receivableId_createdAt_idx" ON "ReceivableContactLog"("receivableId", "createdAt");

ALTER TABLE "ReceivableContactLog" ADD CONSTRAINT "ReceivableContactLog_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "Receivable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReceivableContactLog" ADD CONSTRAINT "ReceivableContactLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
