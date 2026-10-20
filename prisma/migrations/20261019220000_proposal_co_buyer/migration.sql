ALTER TABLE "Proposal" ADD COLUMN "coBuyerId" TEXT;

CREATE INDEX "Proposal_coBuyerId_idx" ON "Proposal"("coBuyerId");

ALTER TABLE "Proposal"
ADD CONSTRAINT "Proposal_coBuyerId_fkey"
FOREIGN KEY ("coBuyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
