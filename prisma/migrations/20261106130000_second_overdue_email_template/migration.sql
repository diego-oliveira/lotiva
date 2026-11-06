ALTER TABLE "DevelopmentSettings"
  ADD COLUMN "overdueSecondEmailSubject" TEXT NOT NULL DEFAULT 'Segundo aviso de parcela em aberto - {{empreendimento}}',
  ADD COLUMN "overdueSecondEmailTemplate" TEXT NOT NULL DEFAULT E'Ola, {{cliente}}!\n\nEsta e uma nova tentativa de contato sobre a parcela {{parcela}} do empreendimento {{empreendimento}}, no valor de {{valor}}, vencida em {{vencimento}}. Ela ainda consta em aberto em nosso sistema.\n\n{{link_boleto}}\n\nSe ja realizou o pagamento, desconsidere esta mensagem.';
