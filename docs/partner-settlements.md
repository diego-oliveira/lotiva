# Distribuição de resultados

Acesso em **Financeiro → Distribuição de resultados** (`/distributions`). Links antigos em `/partner-settlements` redirecionam mantendo o empreendimento e o mês.

## Regras por empreendimento

Configure uma ou mais pessoas ou empresas. Cada participante tem nome, tipo, percentual sobre o líquido positivo e chave Pix opcional. A soma das participações não pode ultrapassar 100%. Cada participante mantém um identificador estável, inclusive quando o nome é corrigido, para preservar os pagamentos.

Exemplo: uma pessoa com 20% e uma empresa com 30% recebem, respectivamente, R$ 3.400 e R$ 5.100 de um resultado líquido de R$ 17.000. Os R$ 8.500 restantes ficam identificados como **saldo da operação**.

Não há mensalidade, despesa ou percentual predefinido para novos clientes. Os custos sugeridos são opcionais e configurados pelo usuário. Gastos avulsos como alimentação, banners e campanhas são lançados no mês, com descrição, categoria, valor, data e comprovante opcional. As categorias são livres, com sugestões de Marketing, Alimentação, Serviços, Taxas e Outros.

## Operação mensal

1. Selecione o empreendimento e salve as regras de distribuição.
2. Escolha o mês e crie um rascunho. Somente os custos explicitamente configurados como sugestões são copiados; confira os valores e as datas.
3. Lance despesas e ajustes identificados de meses anteriores. Salve para recalcular o demonstrativo.
4. Confira recebimentos, comissões pagas, despesas e ajustes. A tela mostra o líquido, o total distribuído, o saldo da operação e o detalhamento por participante.
5. Após o fim do mês, confirme o fechamento. Se os dados mudaram desde a revisão, o servidor exige atualizar e conferir novamente.
6. Registre o Pix já realizado pelo botão do participante. O sistema acompanha separadamente o valor devido, o pago e o saldo de cada pessoa/empresa. Não executa transferências bancárias.
7. Baixe o relatório PDF, com os totais, a distribuição por participante e os lançamentos. Rascunhos geram prévias identificadas como tal.

## Cálculo e datas

`líquido = recebimentos − comissões pagas − custos e despesas + ajustes`

`valor de cada participante = participação sobre o líquido positivo`

`saldo da operação = líquido − soma dos valores distribuídos`

O total distribuído é arredondado em centavos. Os centavos remanescentes são atribuídos pelas maiores frações, com desempate pelo identificador estável, para impedir que várias parcelas arredondadas ultrapassem o resultado disponível. Com participações de 100%, o líquido positivo é totalmente distribuído.

Meses negativos preservam o prejuízo como saldo da operação e não geram distribuição. Não há compensação automática entre meses; use um ajuste identificado quando necessário.

O período usa o horário da Bahia, com início inclusivo e fim exclusivo no primeiro dia do mês seguinte. Recebimentos usam `Receivable.paidAmount` e `Receivable.paidAt`, inclusive baixas parciais. O modelo atual contém um acumulado e uma data por parcela: não representa um extrato de múltiplas baixas em datas diferentes.

Comissões são descontadas pela data do pagamento registrado, não pela liberação da comissão. A data pode ser corrigida em **Comissões → Pagamentos → Alterar data do pagamento**, com auditoria. Não há dedução automática de tarifas bancárias; quando aplicável, lance-as como despesas.

## Histórico e reabertura

As regras e sugestões são copiadas ao criar cada mês. Alterações posteriores não mudam meses existentes. Rascunhos podem adotar as regras atualizadas sem substituir suas despesas; é proibido remover de um mês um participante que já recebeu pagamentos.

**Reabrir para editar** exige justificativa e preserva a versão anterior do demonstrativo e seus pagamentos, consultável em PDF. Os pagamentos atuais são mantidos. Ao fechar novamente, o valor de cada participante precisa cobrir o que ele já recebeu; o saldo de outro participante não pode ser usado para encobrir essa diferença.

Transações serializáveis, versões e identificadores únicos dos pagamentos protegem contra concorrência e registros duplicados. Todas as alterações geram auditoria. Há um fechamento por empreendimento/mês. Mudanças nas fontes de um mês fechado geram aviso, sem recalcular silenciosamente o demonstrativo confirmado.

## Compatibilidade

A migração `20261022160000_generalize_result_distributions` converte acordos existentes de um sócio em uma lista com um participante e vincula pagamentos existentes à identidade `legacy`. Despesas previamente configuradas são preservadas. Snapshots fechados e versões anteriores não são regravados: são adaptados na leitura, conservando os valores confirmados.

Os nomes internos das tabelas e das rotas de API anteriores são preservados por compatibilidade. A interface e os relatórios usam o conceito genérico de distribuição de resultados.

## Acesso, arquivos e implantação

A consulta e os PDFs exigem permissão financeira no empreendimento. Alterações e anexos exigem permissão de operação de pagamentos (`issuePayments`). Corretores não têm acesso a esta área.

Comprovantes aceitam PDF, PNG, JPG e WebP de até 5 MB. São privados e entregues por rota autenticada sem cache público. Em desenvolvimento, ficam em `storage/partner-proofs`; `PARTNER_PROOF_DIR` permite configurar o diretório. O Compose de produção usa o volume persistente `partner_proofs_data`, que precisa integrar o backup de arquivos além do banco, uploads e contratos.

A conversão do relatório PDF reutiliza o LibreOffice usado nos contratos. A implementação e as migrações foram verificadas localmente; não implicam implantação em produção.

## Validação

- `npm test`: cálculos, percentuais, centavos, categorias, saldos individuais, compatibilidade e datas.
- `npx tsc --noEmit` e `npx next build`.
- `npm run test:partner-settlements:integration`: com aplicação e banco locais ativos, valida as APIs usando registros e arquivos temporários removidos ao terminar.
- `PARTNER_TEST_PDF=true npm run test:partner-settlements:integration`: inclui a conversão real de PDFs com um e vários participantes.
