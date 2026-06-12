UPDATE "Proposal" AS proposal
SET "createdById" = COALESCE(
  (
    SELECT event."userId"
    FROM "LotEvent" AS event
    WHERE event."lotId" = proposal."lotId"
      AND event."type" = 'proposal_created'
      AND event."userId" IS NOT NULL
    ORDER BY ABS(EXTRACT(EPOCH FROM (event."createdAt" - proposal."createdAt"))) ASC
    LIMIT 1
  ),
  proposal."createdById"
)
WHERE proposal."status" = 'draft';
