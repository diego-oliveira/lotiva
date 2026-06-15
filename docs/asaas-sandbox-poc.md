# POC Asaas no sandbox

## Objetivo

Validar a API de cobrancas antes de persistir conexoes ou expor telas na
Lotiva. O script:

1. Localiza ou cria um cliente sandbox.
2. Emite 12 boletos individuais com vencimentos mensais.
3. Configura multa de 2% e juros de 1%.
4. Consulta a primeira cobranca.
5. Tenta obter o QR Code Pix associado.
6. Cancela as cobrancas ao final, salvo quando configurado para mante-las.

As parcelas sao individuais, e nao uma assinatura Asaas. Isso preserva a
relacao de uma cobranca para cada recebivel da Lotiva.

## Preparacao

Crie uma conta no sandbox do Asaas e gere uma chave de API. Configure no
arquivo `.env` local:

```env
ASAAS_API_KEY="\$aact_hmlg_..."
ASAAS_POC_CPF_CNPJ="CPF_OU_CNPJ_DE_TESTE"
ASAAS_POC_NAME="Cliente Sandbox Lotiva"
ASAAS_POC_EMAIL="email-de-teste@example.com"
ASAAS_POC_AMOUNT="5.00"
ASAAS_POC_KEEP="false"
```

Nao use credenciais de producao nesta POC e nao versione o arquivo `.env`.
O caractere `$` inicial deve ser escapado com `\`; caso contrario, o carregador
do `.env` pode interpreta-lo como uma referencia a outra variavel.

## Execucao

```bash
npm run poc:asaas
```

Use `ASAAS_POC_KEEP=true` somente quando precisar inspecionar as cobrancas no
painel sandbox. Caso contrario, o script cancela as 12 cobrancas criadas.

## Evidencias a registrar

- IDs do cliente e das cobrancas.
- Status retornados na criacao, consulta e cancelamento.
- Disponibilidade de QR Code Pix em cobranca `BOLETO`.
- Comportamento de vencimentos superiores a 12 meses.
- Payloads reais dos webhooks de pagamento, atraso, estorno e exclusao.
- Eventos duplicados e fora de ordem.
- Limites de requisicao e codigos de erro observados.

## Estado atual

- Cliente Asaas isolado em `lib/payments/asaas-provider.ts`.
- Contrato neutro em `lib/payments/provider.ts`.
- Adaptador fake para testes sem rede.
- Testes automatizados para autenticacao, mapeamento e erros.
- POC real executada em 15 de junho de 2026.
- Doze boletos foram emitidos com vencimentos de julho de 2026 a junho de 2027.
- Consulta e cancelamento das doze cobrancas funcionaram.
- Chave Pix aleatoria ativa confirmada pela API.
- QR Code Pix dinamico do boleto retornado com sucesso.
- A chave Pix deve estar ativa antes da criacao da cobranca.

## Referencias oficiais

- Documentacao: https://docs.asaas.com/
- Autenticacao: https://docs.asaas.com/docs/authentication
- Clientes: https://docs.asaas.com/reference/create-new-customer
- Cobrancas: https://docs.asaas.com/reference/create-new-payment
