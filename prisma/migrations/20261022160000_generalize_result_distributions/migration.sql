-- AlterTable
ALTER TABLE "PartnerAgreement" ADD COLUMN     "participants" JSONB NOT NULL DEFAULT '[]',
ALTER COLUMN "partnerName" SET DEFAULT '',
ALTER COLUMN "percentage" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "PartnerSettlement" ADD COLUMN     "participants" JSONB NOT NULL DEFAULT '[]',
ALTER COLUMN "partnerName" SET DEFAULT '',
ALTER COLUMN "percentage" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "PartnerPayment" ADD COLUMN     "participantId" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN     "participantName" TEXT NOT NULL DEFAULT '';

-- Preserve the previous single-recipient agreement and its payment identity.
-- Closed snapshots and revision JSON are intentionally left untouched.
UPDATE "PartnerAgreement" SET "participants" = jsonb_build_array(jsonb_build_object(
  'id', 'legacy', 'kind', 'person', 'name', "partnerName", 'percentage', "percentage", 'pixKey', "pixKey"
)) WHERE "partnerName" <> '' AND "percentage" > 0;
UPDATE "PartnerSettlement" SET "participants" = jsonb_build_array(jsonb_build_object(
  'id', 'legacy', 'kind', 'person', 'name', "partnerName", 'percentage', "percentage", 'pixKey', "pixKey"
)) WHERE "partnerName" <> '' AND "percentage" > 0;
UPDATE "PartnerPayment" p SET "participantName" = s."partnerName"
FROM "PartnerSettlement" s WHERE s.id = p."settlementId";
