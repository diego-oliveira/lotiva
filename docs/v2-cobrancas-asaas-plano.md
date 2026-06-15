# V2 - Cobrancas integradas e ciclos anuais

## Objetivo

Integrar a Lotiva inicialmente ao Asaas para emitir boleto e Pix das parcelas
de vendas, acompanhar pagamentos automaticamente e renovar as cobrancas em
ciclos configuraveis, com padrao de 12 meses e reajuste antes de cada ciclo.

## Decisoes de produto

- A Lotiva continua sendo a fonte oficial do contrato e dos recebiveis.
- Cada incorporadora conecta sua propria conta Asaas.
- O dinheiro vai diretamente para a conta da incorporadora.
- O plano completo de parcelas existe na Lotiva, mas somente o ciclo vigente
  e enviado ao provedor.
- O ciclo padrao tem 12 parcelas e nao ultrapassa a proxima data de reajuste.
- O reajuste precisa ser calculado e aprovado antes da emissao do novo ciclo.
- Cada cobranca externa corresponde a um recebivel especifico da Lotiva.
- Webhooks atualizam a Lotiva, mas uma conciliacao periodica confirma o estado.
- A integracao usa uma interface de provedor para permitir Efí ou outro
  provedor no futuro.

## Fora do primeiro escopo

- Conta digital white-label ou BaaS.
- Cartoes e antecipacao de recebiveis.
- Negativacao automatica.
- Repasse de dinheiro pela conta da Lotiva.
- Portal completo do comprador.
- Reajuste sem revisao humana.

## Arquitetura proposta

### Plano contratual

Ao concluir uma venda, a Lotiva cria todas as parcelas contratuais. Elas
representam a obrigacao do comprador, mesmo quando ainda nao foram enviadas
ao Asaas.

Cada recebivel deve ter:

- Numero e vencimento original.
- Valor-base e valor vigente.
- Ciclo anual.
- Indice e percentual de reajuste aplicado.
- Status contratual.
- Status de cobranca externa.

### Ciclo de cobranca

O primeiro ciclo emite ate 12 parcelas, limitado pelo total restante e pela
proxima data de reajuste.

Sessenta, trinta e quinze dias antes do fim do ciclo, administradores recebem
alertas. O proximo ciclo segue este fluxo:

1. Informar o indice e o percentual do periodo.
2. Simular os novos valores.
3. Registrar justificativa e fonte do indice.
4. Aprovar o reajuste.
5. Atualizar somente as parcelas futuras ainda nao emitidas.
6. Emitir o proximo ciclo no provedor.

### Provedor de pagamentos

Criar uma interface interna com operacoes como:

```text
createCustomer
createCharge
updateCharge
cancelCharge
getCharge
listCharges
verifyWebhook
```

O primeiro adaptador sera `AsaasPaymentProvider`. Regras de venda e financeiro
nao devem importar tipos ou status especificos do Asaas.

### Webhooks e conciliacao

- Persistir o evento antes de processa-lo.
- Usar o ID externo do evento como chave unica.
- Retornar HTTP 200 rapidamente.
- Processar eventos de forma idempotente.
- Manter payload original para auditoria.
- Executar conciliacao diaria das cobrancas abertas ou alteradas recentemente.
- Divergencias devem gerar uma pendencia operacional, nunca ajuste silencioso.

## Modelo de dados

Entidades sugeridas:

- `PaymentProviderConnection`: conexao da empresa com Asaas, ambiente e status.
- `ExternalCustomer`: vinculo entre comprador e cliente no provedor.
- `ExternalCharge`: cobranca externa vinculada ao recebivel.
- `PaymentWebhookEvent`: eventos recebidos e estado do processamento.
- `BillingCycle`: conjunto de parcelas emitidas sob a mesma regra anual.
- `AdjustmentReview`: indice, percentual, simulacao, aprovador e auditoria.
- `ReconciliationRun`: execucao e divergencias da conciliacao.

Valores monetarios novos devem usar `Decimal`, nunca `Float`. A migracao dos
valores financeiros existentes deve ser planejada antes da integracao.

## Fases

### Fase 0 - Descoberta e sandbox

- Abrir conta sandbox Asaas.
- Confirmar boleto com Pix, multa, juros, vencimento e cancelamento.
- Validar limites para cobrancas futuras e alteracoes.
- Simular webhooks duplicados e fora de ordem.
- Registrar custos e termos comerciais.

Saida: decisao tecnica documentada e prova de conceito sem dados reais.

### Fase 1 - Fundacao financeira

- Migrar dinheiro de `Float` para `Decimal`.
- Separar status contratual do status da cobranca.
- Criar interface multi-provedor.
- Criar armazenamento criptografado das credenciais.
- Adicionar trilha de auditoria.

Saida: dominio financeiro pronto sem chamadas reais ao Asaas.

### Fase 2 - Ciclos e reajustes

- Configurar tamanho do ciclo, padrao 12.
- Criar ciclos de cobranca.
- Implementar simulacao e aprovacao de reajuste.
- Bloquear emissao alem da proxima data de reajuste.
- Criar notificacoes de 60, 30 e 15 dias.

Saida: fluxo anual completo operando internamente.

### Fase 3 - Integracao Asaas

- Configurar conexao por empresa.
- Sincronizar compradores.
- Emitir e cancelar cobrancas.
- Persistir IDs, URLs de boleto, linha digitavel e Pix.
- Implementar retry com idempotencia.

Saida: ciclo de 12 parcelas emitido no sandbox.

### Fase 4 - Webhooks e conciliacao

- Endpoint autenticado de webhook.
- Mapeamento de pagamentos, atrasos, estornos e cancelamentos.
- Fila ou processamento assincrono.
- Conciliacao diaria.
- Tela de divergencias e reprocessamento.

Saida: pagamentos atualizam recebiveis sem intervencao manual.

### Fase 5 - Experiencia operacional

- Tela de conexao e saude do provedor.
- Acao de emitir ciclo.
- Consulta de boleto e Pix por parcela.
- Tela de reajuste e aprovacao.
- Historico financeiro auditavel.
- Indicadores de emissao, pagamento, atraso e falha.

Saida: operacao utilizavel por administradores e financeiro.

### Fase 6 - Producao controlada

- Testes de contrato e integracao.
- Alertas e observabilidade.
- Rotacao de credenciais.
- Plano de contingencia e reconciliacao manual.
- Piloto com uma incorporadora e poucas vendas.
- Expansao gradual apos dois ciclos de cobranca sem divergencias criticas.

## Criterios globais de aceite

- Nenhuma cobranca duplicada em retries ou webhooks repetidos.
- Nenhuma parcela posterior ao reajuste emitida com valor antigo.
- Pagamentos conciliados preservam data, valor bruto, tarifa e valor liquido.
- Alteracoes manuais exigem permissao e ficam auditadas.
- Credenciais nunca aparecem em logs ou respostas da API.
- Indisponibilidade do provedor nao impede consultar vendas e recebiveis.
- Toda divergencia pode ser reprocessada sem editar o banco manualmente.

## Backlog sugerido para GitHub

Criar o milestone **V2 - Cobrancas integradas** e usar labels como:

- `P0`, `P1`
- `payments`
- `backend`, `frontend`, `database`
- `security`
- `spike` para a prova de conceito

### Epico

**P0: V2 - Integrar cobrancas Asaas com ciclos anuais**

Resultado: emitir ate 12 parcelas por ciclo, aplicar reajustes aprovados e
conciliar pagamentos automaticamente.

### Issues

1. **P0: Executar prova de conceito da API Asaas no sandbox**
   - Cliente, boleto/Pix, multa, juros, cancelamento e webhooks.
   - Documentar limites, erros e comportamento idempotente.

2. **P0: Migrar valores financeiros de Float para Decimal**
   - Sale, Proposal e Receivable.
   - Definir arredondamento monetario e validar dados existentes.

3. **P0: Modelar conexoes, cobrancas externas e eventos de pagamento**
   - Criar migration para conexao, cliente externo, cobranca e webhook.
   - Adicionar indices e chaves unicas de idempotencia.

4. **P0: Criar interface multi-provedor de pagamentos**
   - Contratos neutros para clientes, cobrancas e consulta.
   - Adaptador fake para testes.

5. **P0: Implementar ciclos de cobranca configuraveis**
   - Padrao de 12 meses.
   - Nunca ultrapassar a proxima data de reajuste.

6. **P0: Implementar revisao e aprovacao de reajuste anual**
   - Simulacao, fonte, percentual, aprovador e auditoria.
   - Atualizar somente parcelas futuras elegiveis.

7. **P0: Implementar conexao de uma empresa com o Asaas**
   - Ambiente sandbox/producao, teste de conexao e rotacao de chave.
   - Credenciais criptografadas.

8. **P0: Implementar emissao de cobrancas no Asaas**
   - Sincronizar cliente e emitir ciclo.
   - Salvar boleto, Pix, IDs externos e falhas por parcela.

9. **P0: Processar webhooks Asaas com idempotencia**
   - Validar autenticidade, persistir payload e processar assincronamente.
   - Cobrir pagamento, atraso, cancelamento e estorno.

10. **P0: Implementar conciliacao diaria com o Asaas**
    - Consultar cobrancas abertas e eventos recentes.
    - Criar pendencias para divergencias.

11. **P1: Criar UI de cobrancas e ciclos na venda**
    - Status por parcela, boleto/Pix, emissao e cancelamento controlado.

12. **P1: Criar UI de reajuste anual**
    - Alertas, simulacao, aprovacao e emissao do proximo ciclo.

13. **P0: Adicionar auditoria e permissoes do modulo financeiro**
    - Separar conectar provedor, emitir, cancelar, reajustar e conciliar.

14. **P0: Adicionar observabilidade e operacao de falhas**
    - Alertas, retries, reprocessamento e painel de saude.

15. **P0: Executar piloto de producao com uma incorporadora**
    - Checklist operacional e financeiro.
    - Criterios objetivos de expansao.

## Ordem recomendada

`1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11/12/13/14 -> 15`

As issues 11 a 14 podem ser desenvolvidas parcialmente em paralelo depois que
o modelo de dados e os contratos do provedor estiverem estabilizados.

As issues existentes de financeiro continuam validas para o controle interno.
Este backlog trata especificamente da emissao externa, conciliacao e renovacao
dos ciclos; nao deve substituir o `Receivable` por dados vindos do provedor.

## Priorizacao de execucao

### Onda 1 - Validar viabilidade

Objetivo: remover incertezas externas antes de alterar o dominio financeiro.

1. **Issue 1: Prova de conceito Asaas no sandbox**

Entregas obrigatorias:

- Criar cliente e cobranca de teste.
- Emitir boleto com Pix.
- Configurar multa e juros.
- Consultar e cancelar cobranca.
- Receber webhooks duplicados e fora de ordem.
- Confirmar como emitir 12 vencimentos futuros.
- Documentar limites, tarifas e comportamento dos status.

Esta issue bloqueia a implementacao do adaptador Asaas, mas nao bloqueia o
trabalho de valores monetarios.

### Onda 2 - Corrigir a fundacao financeira

Objetivo: preparar dados confiaveis antes de armazenar transacoes externas.

2. **Issue 2: Migrar valores financeiros de Float para Decimal**
3. **Issue 3: Modelar conexoes, cobrancas externas e eventos**
4. **Issue 4: Criar interface multi-provedor e adaptador fake**

Ordem:

- A issue 2 deve ser concluida primeiro.
- As issues 3 e 4 podem avancar em paralelo depois que os tipos monetarios
  estiverem definidos.

Marco de conclusao:

- Valores sem erro de ponto flutuante.
- Modelo externo sem dependencia direta do Asaas.
- Testes usando provedor fake.

### Onda 3 - Ciclos e reajustes internos

Objetivo: fazer a Lotiva controlar corretamente os 12 meses antes de chamar
um provedor real.

5. **Issue 5: Implementar ciclos configuraveis**
6. **Issue 6: Implementar revisao e aprovacao do reajuste**
13. **Issue 13: Permissoes e auditoria financeira**

Ordem:

- Ciclos primeiro.
- Reajuste depende dos ciclos.
- Permissoes e auditoria devem acompanhar as operacoes, nao ser adicionadas
  somente no final.

Marco de conclusao:

- Primeiro ciclo criado com ate 12 parcelas.
- Nenhuma parcela alem do reajuste pode ser emitida.
- Novo valor exige aprovacao e fica auditado.

### Onda 4 - Conectar e emitir no Asaas

Objetivo: integrar o dominio validado ao sandbox.

7. **Issue 7: Conexao da empresa com o Asaas**
8. **Issue 8: Emissao e cancelamento de cobrancas**

Ordem:

- Conexao e teste de credenciais.
- Sincronizacao do comprador.
- Emissao do ciclo.
- Cancelamento e reemissao controlados.

Marco de conclusao:

- Uma venda gera 12 cobrancas no sandbox.
- Cada cobranca fica ligada a um unico recebivel.
- Retry nao cria cobranca duplicada.

### Onda 5 - Retorno financeiro confiavel

Objetivo: atualizar a Lotiva automaticamente e detectar divergencias.

9. **Issue 9: Webhooks idempotentes**
10. **Issue 10: Conciliacao diaria**
14. **Issue 14: Observabilidade e operacao de falhas**

Ordem:

- Webhooks primeiro.
- Conciliacao confirma o resultado dos webhooks.
- Observabilidade acompanha ambas desde o inicio da onda.

Marco de conclusao:

- Pagamento no sandbox atualiza a parcela uma unica vez.
- Evento repetido nao duplica pagamento.
- Divergencias aparecem como pendencia operacional.

### Onda 6 - Experiencia do usuario

Objetivo: expor apenas fluxos financeiros tecnicamente estabilizados.

11. **Issue 11: UI de cobrancas e ciclos**
12. **Issue 12: UI de reajuste anual**

Essas duas issues podem ser desenvolvidas em paralelo depois que os contratos
das APIs internas estiverem definidos.

Marco de conclusao:

- Financeiro consulta boleto, Pix, pagamentos e falhas.
- Administrador simula, aprova e emite o ciclo reajustado.

### Onda 7 - Producao controlada

15. **Issue 15: Piloto com uma incorporadora**

Comecar com:

- Uma conta Asaas.
- Um empreendimento.
- Poucas vendas novas.
- Monitoramento diario.
- Emissao inicial revisada por administrador.

Expandir somente quando webhooks, conciliacao e fechamento financeiro
permanecerem sem divergencias criticas durante o periodo definido no piloto.

## Prioridade resumida

| Ordem | Issue | Prioridade | Bloqueia |
|---|---|---|---|
| 1 | POC Asaas | P0 | Integracao real |
| 2 | Float para Decimal | P0 | Todo o dominio financeiro |
| 3 | Modelo de dados externo | P0 | Emissao e webhooks |
| 4 | Interface multi-provedor | P0 | Adaptador Asaas testavel |
| 5 | Ciclos de cobranca | P0 | Reajuste e emissao anual |
| 6 | Reajuste aprovado | P0 | Segundo ciclo |
| 7 | Conexao Asaas | P0 | Emissao real |
| 8 | Emissao Asaas | P0 | Webhooks e operacao |
| 9 | Webhooks | P0 | Atualizacao automatica |
| 10 | Conciliacao | P0 | Confiabilidade financeira |
| 13 | Permissoes e auditoria | P0 | Producao segura |
| 14 | Observabilidade | P0 | Piloto seguro |
| 11 | UI de cobrancas | P1 | Operacao eficiente |
| 12 | UI de reajuste | P1 | Operacao anual eficiente |
| 15 | Piloto | P0 | Liberacao gradual |

## Primeira entrega recomendada

O primeiro ciclo de desenvolvimento deve conter somente:

1. POC Asaas no sandbox.
2. Especificacao da migracao de `Float` para `Decimal`.
3. Contrato da interface `PaymentProvider`.

Nao iniciar ainda a tela de cobrancas nem a persistencia definitiva das
credenciais. As respostas obtidas na POC podem alterar esses contratos.

## Progresso da primeira entrega

- [x] Migracao monetaria para `Decimal(15,2)` preparada.
- [x] Arredondamento monetario centralizado e coberto por testes.
- [x] Contrato `PaymentProvider` criado.
- [x] Adaptador fake criado para testes sem rede.
- [x] Cliente Asaas sandbox criado com testes de contrato HTTP.
- [x] Script da POC de 12 cobrancas criado.
- [x] Executar a POC contra uma conta sandbox real.
- [x] Validar emissao e cancelamento de 12 vencimentos futuros.
- [x] Cadastrar chave Pix no sandbox e validar QR Code do boleto.
- [ ] Registrar payloads reais dos webhooks e limites observados.
- [x] Modelar conexoes, clientes externos, ciclos, cobrancas e eventos.
- [x] Adicionar chaves unicas de idempotencia no banco.
- [x] Implementar emissao interna de ciclo com ate 12 parcelas.
- [x] Validar retry sem duplicar ciclo ou cobrancas.
- [x] Criptografar credenciais do provedor com AES-256-GCM.
- [x] Criar API de conexao Asaas por empresa.
- [x] Criar API financeira para emitir e consultar ciclos por venda.
