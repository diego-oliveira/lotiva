ALTER TABLE "Reservation"
ADD COLUMN "createdById" TEXT;

UPDATE "Reservation" AS reservation
SET "createdById" = (
  SELECT event."userId"
  FROM "LotEvent" AS event
  WHERE event."lotId" = reservation."lotId"
    AND event."type" = 'reservation_created'
    AND event."userId" IS NOT NULL
  ORDER BY ABS(EXTRACT(EPOCH FROM (event."createdAt" - reservation."createdAt"))) ASC
  LIMIT 1
)
WHERE reservation."createdById" IS NULL;

CREATE INDEX "Reservation_createdById_idx" ON "Reservation"("createdById");

ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
