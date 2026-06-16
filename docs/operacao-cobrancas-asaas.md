# Operacao de cobrancas Asaas

## Componentes

- A Lotiva cria no maximo 12 cobrancas por ciclo.
- O primeiro ciclo pode ser emitido diretamente.
- Ciclos posteriores exigem reajuste aprovado quando a venda possui reajuste anual.
- Webhooks atualizam pagamentos, vencimentos, cancelamentos e estornos.
- A conciliacao diaria consulta o Asaas e corrige divergencias de forma auditada.
- Eventos repetidos usam o ID do Asaas como chave de idempotencia.

## Variaveis obrigatorias

```text
PAYMENT_CREDENTIALS_KEY
PAYMENT_WEBHOOK_BASE_URL
CRON_SECRET
```

`PAYMENT_WEBHOOK_BASE_URL` deve ser a origem HTTPS publica, sem barra final:

```text
https://app.seudominio.com
```

Depois de configurar as variaveis, abra `Empresas`, clique em `Asaas` e salve
novamente a chave. A Lotiva criara ou atualizara a fila de webhook da conta.

Tambem e possivel sincronizar todas as conexoes ativas pela linha de comando:

```bash
npm run payments:webhooks:configure
```

Esse comando e especialmente util em desenvolvimento quando a URL gratuita
do ngrok muda.

## Jobs

Processar eventos pendentes:

```bash
./scripts/run-payment-jobs.sh events
```

Executar eventos, conciliacao e alertas de reajuste:

```bash
./scripts/run-payment-jobs.sh daily
```

## Falhas

O painel `Financeiro > Operacao Asaas` exibe:

- Estado do webhook por ambiente.
- Ultima conciliacao.
- Webhooks com falha e acao de reprocessamento.
- Divergencias pendentes.

Uma indisponibilidade do Asaas nao impede consultar vendas e parcelas. Os
eventos falhos usam retry exponencial de ate 60 minutos.

## Cancelamento e reemissao

- Cobrancas confirmadas ou recebidas nao podem ser canceladas pela Lotiva.
- Cancelamento exige justificativa.
- Reemissao cria uma nova referencia versionada e preserva a cobranca anterior.
- Para registrar pagamento manual, cancele antes qualquer cobranca externa ativa.

## Piloto

1. Use uma empresa e um empreendimento.
2. Configure primeiro o Sandbox e valide o status ativo do webhook.
3. Emita uma venda de teste com ate 12 parcelas.
4. Confirme um pagamento no Sandbox.
5. Execute o job `events` e confira a baixa na Lotiva.
6. Execute `daily` e confirme uma conciliacao sem divergencias pendentes.
7. Repita com cancelamento, reemissao e estorno.
8. Somente depois configure a chave de Producao.
