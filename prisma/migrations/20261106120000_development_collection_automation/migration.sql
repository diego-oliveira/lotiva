ALTER TABLE "DevelopmentSettings"
  ADD COLUMN "autoIssueBoleto" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "autoIssueBoletoDaysBefore" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN "autoSendBoletoEmail" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "overdueEmailEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "overdueFirstReminderDays" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "overdueSecondReminderDays" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "boletoEmailSubject" TEXT NOT NULL DEFAULT 'Boleto da parcela - {{empreendimento}}',
  ADD COLUMN "boletoEmailTemplate" TEXT NOT NULL DEFAULT E'Ola, {{cliente}}!\n\nSegue o boleto da parcela {{parcela}} do empreendimento {{empreendimento}}, no valor de {{valor}}, com vencimento em {{vencimento}}.\n\n{{link_boleto}}\n\nSe ja realizou o pagamento, desconsidere esta mensagem.',
  ADD COLUMN "overdueEmailSubject" TEXT NOT NULL DEFAULT 'Parcela em aberto - {{empreendimento}}',
  ADD COLUMN "overdueEmailTemplate" TEXT NOT NULL DEFAULT E'Ola, {{cliente}}!\n\nA parcela {{parcela}} do empreendimento {{empreendimento}}, no valor de {{valor}}, venceu em {{vencimento}} e consta em aberto.\n\n{{link_boleto}}\n\nSe ja realizou o pagamento, desconsidere esta mensagem.';

ALTER TABLE "ReceivableContactLog" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "ReceivableContactLog" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "ReceivableContactLog" ADD COLUMN "deliveryStatus" TEXT NOT NULL DEFAULT 'sent';
ALTER TABLE "ReceivableContactLog" ADD COLUMN "deduplicationKey" TEXT;
ALTER TABLE "ReceivableContactLog" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ReceivableContactLog" DROP CONSTRAINT "ReceivableContactLog_userId_fkey";
ALTER TABLE "ReceivableContactLog" ADD CONSTRAINT "ReceivableContactLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ReceivableContactLog_deduplicationKey_key" ON "ReceivableContactLog"("deduplicationKey");
