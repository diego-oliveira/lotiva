# Contexto de loteamento

Implementação retomada em 22/10/2026:

- Mostrar o loteamento no breadcrumb acima do título; o próprio nome abre um seletor compacto com busca, indicação da seleção atual e opção de todos nas telas consolidadas. Com apenas um loteamento, mostrar o nome sem controle de troca.
- Oferecer “Todos os loteamentos” nas telas de acompanhamento, respeitando os acessos do usuário.
- Vendas e Propostas devem permitir tanto “Todos” quanto um loteamento específico; identificar o loteamento de cada registro na visão consolidada.
- Considerar a visão consolidada também para Painel, Recebimentos e Comissões.
- Manter Lotes e Configurações no contexto de um loteamento específico.
- Preservar a seleção entre telas e lembrar a última escolha; selecionar automaticamente quando houver apenas um loteamento acessível.
- Ao criar uma venda ou proposta na visão “Todos”, exigir a escolha do loteamento antes do lote. Se o filtro já indicar um loteamento, preencher esse contexto automaticamente.
- Ações iniciadas a partir de um registro devem usar o loteamento desse registro.

Lotes e Distribuição de resultados exigem um loteamento específico. O financeiro consolidado inclui apenas loteamentos com permissão financeira, e cada ação de cobrança verifica a permissão no loteamento do registro. Operações de integração bancária permanecem na visão específica.
