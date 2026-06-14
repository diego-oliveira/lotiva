type TemplateSale = {
  totalValue: number
  downPayment: number
  installmentCount: number
  installmentValue: number
  firstDueDate?: Date | string | null
  annualAdjustment: boolean
  user: {
    name: string
    email: string
    cpf?: string | null
    rg?: string | null
    address?: string | null
    birthDate?: Date | string | null
    profession?: string | null
    birthplace?: string | null
    maritalStatus?: string | null
  }
  lot: {
    identifier: string
    totalArea: number
    front: number
    back: number
    leftSide: number
    rightSide: number
    block: {
      identifier: string
      development?: {
        name: string
        company?: {
          name: string
          documentVariables?: Array<{
            key: string
            required?: boolean
            defaultValue?: string | null
          }>
        } | null
        contractSettings?: {
          sellerName?: string | null
          sellerDocument?: string | null
          sellerAddress?: string | null
          sellerRepresentatives?: string | null
          propertyDescription?: string | null
          acquisitionDescription?: string | null
          paymentInstructions?: string | null
          jurisdiction?: string | null
          additionalClauses?: string | null
        } | null
        documentValues?: Array<{
          value: string
          variable: {
            key: string
            defaultValue?: string | null
          }
        }>
      } | null
    }
  }
  proposal?: {
    notes?: string | null
    interestRate?: number | null
    correctionIndex?: string | null
  } | null
}

export const documentVariableGroups = [
  {
    label: 'Contrato',
    variables: [
      ['contrato.numero', 'Numero do contrato'],
      ['contrato.data', 'Data de emissao'],
    ],
  },
  {
    label: 'Empresa e empreendimento',
    variables: [
      ['empresa.nome', 'Nome da empresa'],
      ['empreendimento.nome', 'Nome do empreendimento'],
      ['empreendimento.descricao', 'Descricao do empreendimento'],
      ['empreendimento.origem_imovel', 'Origem e regularidade do imovel'],
    ],
  },
  {
    label: 'Vendedor',
    variables: [
      ['vendedor.nome', 'Nome ou razao social'],
      ['vendedor.documento', 'CPF ou CNPJ'],
      ['vendedor.endereco', 'Endereco'],
      ['vendedor.representantes', 'Representantes'],
      ['vendedor.instrucoes_pagamento', 'Instrucoes de pagamento'],
      ['vendedor.foro', 'Foro'],
      ['vendedor.clausulas_adicionais', 'Clausulas adicionais'],
    ],
  },
  {
    label: 'Cliente',
    variables: [
      ['cliente.nome', 'Nome'],
      ['cliente.email', 'Email'],
      ['cliente.cpf', 'CPF'],
      ['cliente.rg', 'RG'],
      ['cliente.endereco', 'Endereco'],
      ['cliente.nascimento', 'Data de nascimento'],
      ['cliente.profissao', 'Profissao'],
      ['cliente.naturalidade', 'Naturalidade'],
      ['cliente.estado_civil', 'Estado civil'],
    ],
  },
  {
    label: 'Lote',
    variables: [
      ['lote.numero', 'Numero do lote'],
      ['lote.quadra', 'Quadra'],
      ['lote.area', 'Area total'],
      ['lote.frente', 'Frente'],
      ['lote.fundo', 'Fundo'],
      ['lote.lateral_esquerda', 'Lateral esquerda'],
      ['lote.lateral_direita', 'Lateral direita'],
    ],
  },
  {
    label: 'Venda',
    variables: [
      ['venda.valor_total', 'Valor total'],
      ['venda.entrada', 'Entrada'],
      ['venda.saldo', 'Saldo'],
      ['venda.numero_parcelas', 'Numero de parcelas'],
      ['venda.valor_parcela', 'Valor da parcela'],
      ['venda.primeiro_vencimento', 'Primeiro vencimento'],
      ['venda.reajuste', 'Regra de reajuste'],
      ['proposta.observacoes', 'Observacoes da proposta'],
    ],
  },
] as const

const knownVariables = new Set<string>(
  documentVariableGroups.flatMap((group) => group.variables.map(([name]) => name)),
)
const optionalVariables = new Set([
  'vendedor.representantes',
  'vendedor.clausulas_adicionais',
  'proposta.observacoes',
])

export const defaultContractTemplate = `CONTRATO PARTICULAR DE PROMESSA DE COMPRA E VENDA DE IMOVEL

Por este instrumento particular, as partes abaixo identificadas ajustam a promessa de compra e venda de lote integrante do empreendimento {{empreendimento.nome}}.

PROMITENTE VENDEDOR
{{vendedor.nome}}, documento {{vendedor.documento}}, com endereco em {{vendedor.endereco}}.
{{vendedor.representantes}}

PROMITENTE COMPRADOR
{{cliente.nome}}, {{cliente.estado_civil}}, {{cliente.profissao}}, natural de {{cliente.naturalidade}}, RG {{cliente.rg}}, CPF {{cliente.cpf}}, residente em {{cliente.endereco}}, email {{cliente.email}}.

1. DO EMPREENDIMENTO
{{empreendimento.descricao}}

2. DA ORIGEM E REGULARIDADE
{{empreendimento.origem_imovel}}

3. DO OBJETO
O vendedor promete vender ao comprador o lote {{lote.numero}} da quadra {{lote.quadra}}, com area total de {{lote.area}}, frente de {{lote.frente}}, fundo de {{lote.fundo}}, lateral esquerda de {{lote.lateral_esquerda}} e lateral direita de {{lote.lateral_direita}}.

4. DO PRECO E PAGAMENTO
O valor total da venda e de {{venda.valor_total}}. O comprador pagara entrada de {{venda.entrada}} e o saldo de {{venda.saldo}} em {{venda.numero_parcelas}} parcela(s) de {{venda.valor_parcela}}, com primeiro vencimento em {{venda.primeiro_vencimento}}. {{venda.reajuste}}

{{vendedor.instrucoes_pagamento}}

5. CLAUSULAS ADICIONAIS
{{vendedor.clausulas_adicionais}}

6. DO FORO
As partes elegem o foro de {{vendedor.foro}} para dirimir duvidas oriundas deste contrato, com renuncia a qualquer outro.

{{vendedor.foro}}, {{contrato.data}}.


____________________________________
{{vendedor.nome}}
{{vendedor.documento}}


____________________________________
{{cliente.nome}}
CPF {{cliente.cpf}}


____________________________________
Testemunha 1


____________________________________
Testemunha 2

Contrato numero {{contrato.numero}}`

export function generateContractNumber() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')

  return `CT${year}${month}${day}${time}${random}`
}

function formatDate(value?: Date | string | null) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatNumber(value: number, suffix = '') {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${suffix}`
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function getTemplateVariables(content: string) {
  return [...content.matchAll(/{{\s*([^{}]+?)\s*}}/g)].map((match) => match[1].trim())
}

export function validateTemplateContent(content: string, customKeys: string[] = []) {
  const variables = getTemplateVariables(content)
  const allowedCustomVariables = new Set(customKeys.map((key) => `custom.${key}`))
  return {
    variables: [...new Set(variables)],
    customVariables: [...new Set(variables.filter((variable) => variable.startsWith('custom.')))],
    unknownVariables: [...new Set(variables.filter(
      (variable) => variable !== 'quebra_pagina' && !knownVariables.has(variable) && !allowedCustomVariables.has(variable),
    ))],
  }
}

function buildValues(sale: TemplateSale, contractNumber: string, generatedAt: Date) {
  const development = sale.lot.block.development
  const settings = development?.contractSettings
  const balance = Math.max(sale.totalValue - sale.downPayment, 0)

  const customDefaults = Object.fromEntries(
    (development?.company?.documentVariables ?? []).map((variable) => [
      `custom.${variable.key}`,
      variable.defaultValue || '',
    ]),
  )
  const customOverrides = Object.fromEntries(
    (development?.documentValues ?? []).map((item) => [
      `custom.${item.variable.key}`,
      item.value || item.variable.defaultValue || '',
    ]),
  )

  return {
    'contrato.numero': contractNumber,
    'contrato.data': formatDate(generatedAt),
    'empresa.nome': development?.company?.name ?? '',
    'empreendimento.nome': development?.name ?? '',
    'empreendimento.descricao': settings?.propertyDescription ?? '',
    'empreendimento.origem_imovel': settings?.acquisitionDescription ?? '',
    'vendedor.nome': settings?.sellerName ?? '',
    'vendedor.documento': settings?.sellerDocument ?? '',
    'vendedor.endereco': settings?.sellerAddress ?? '',
    'vendedor.representantes': settings?.sellerRepresentatives ?? '',
    'vendedor.instrucoes_pagamento': settings?.paymentInstructions ?? '',
    'vendedor.foro': settings?.jurisdiction ?? '',
    'vendedor.clausulas_adicionais': settings?.additionalClauses ?? '',
    'cliente.nome': sale.user.name,
    'cliente.email': sale.user.email,
    'cliente.cpf': sale.user.cpf ?? '',
    'cliente.rg': sale.user.rg ?? '',
    'cliente.endereco': sale.user.address ?? '',
    'cliente.nascimento': formatDate(sale.user.birthDate),
    'cliente.profissao': sale.user.profession ?? '',
    'cliente.naturalidade': sale.user.birthplace ?? '',
    'cliente.estado_civil': sale.user.maritalStatus ?? '',
    'lote.numero': sale.lot.identifier,
    'lote.quadra': sale.lot.block.identifier,
    'lote.area': formatNumber(sale.lot.totalArea, ' m2'),
    'lote.frente': formatNumber(sale.lot.front, ' m'),
    'lote.fundo': formatNumber(sale.lot.back, ' m'),
    'lote.lateral_esquerda': formatNumber(sale.lot.leftSide, ' m'),
    'lote.lateral_direita': formatNumber(sale.lot.rightSide, ' m'),
    'venda.valor_total': formatCurrency(sale.totalValue),
    'venda.entrada': formatCurrency(sale.downPayment),
    'venda.saldo': formatCurrency(balance),
    'venda.numero_parcelas': String(sale.installmentCount),
    'venda.valor_parcela': formatCurrency(sale.installmentValue),
    'venda.primeiro_vencimento': formatDate(sale.firstDueDate),
    'venda.reajuste': sale.annualAdjustment ? 'Com reajuste anual.' : 'Sem reajuste anual.',
    'proposta.observacoes': sale.proposal?.notes ?? '',
    ...customDefaults,
    ...customOverrides,
  } satisfies Record<string, string>
}

export function renderDocumentTemplate(input: {
  content: string
  sale: TemplateSale
  contractNumber: string
  generatedAt: Date
}) {
  const customKeys = [
    ...(input.sale.lot.block.development?.company?.documentVariables ?? []).map((item) => item.key),
    ...(input.sale.lot.block.development?.documentValues ?? []).map((item) => item.variable.key),
  ]
  const validation = validateTemplateContent(input.content, customKeys)
  if (validation.unknownVariables.length > 0) {
    throw new Error(`Variaveis desconhecidas: ${validation.unknownVariables.join(', ')}`)
  }

  const values = buildValues(input.sale, input.contractNumber, input.generatedAt)
  const optionalCustomVariables = new Set(
    (input.sale.lot.block.development?.company?.documentVariables ?? [])
      .filter((variable) => !variable.required)
      .map((variable) => `custom.${variable.key}`),
  )
  const missingVariables = validation.variables.filter(
    (variable) =>
      variable !== 'quebra_pagina' &&
      !optionalVariables.has(variable) &&
      !optionalCustomVariables.has(variable) &&
      !String(values[variable as keyof typeof values] ?? '').trim(),
  )
  let rendered = input.content.replace(/{{\s*([^{}]+?)\s*}}/g, (_, rawVariable: string) => {
    const variable = rawVariable.trim()
    if (variable === 'quebra_pagina') return '\n[[PAGE_BREAK]]\n'
    return String(values[variable as keyof typeof values] ?? '')
  })

  const sections = rendered.split('[[PAGE_BREAK]]')
  const body = sections
    .map((section) => `<section class="page">${escapeHtml(section.trim())}</section>`)
    .join('')

  return {
    missingVariables: [...new Set(missingVariables)],
    html: `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Contrato ${escapeHtml(input.contractNumber)}</title>
  <style>
    body { margin: 0; background: #f3f4f6; color: #111827; font-family: Georgia, "Times New Roman", serif; }
    .page { box-sizing: border-box; max-width: 860px; min-height: 1120px; margin: 24px auto; padding: 64px; background: #fff; white-space: pre-wrap; line-height: 1.7; text-align: justify; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    @media print { body { background: #fff; } .page { max-width: none; min-height: auto; margin: 0; padding: 0; } }
  </style>
</head>
<body>${body}</body>
</html>`,
  }
}
