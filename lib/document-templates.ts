import type { MoneyInput } from './money'
import { moneyToNumber } from './money'

type TemplateSale = {
  totalValue: MoneyInput
  downPayment: MoneyInput
  downPaymentInstallmentCount?: number
  downPaymentFirstDueDate?: Date | string | null
  installmentCount: number
  installmentValue: MoneyInput
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
  participants?: Array<{
    relationshipType: string
    user: {
      name: string; email: string; cpf?: string | null; rg?: string | null; address?: string | null
      birthDate?: Date | string | null; profession?: string | null; birthplace?: string | null; maritalStatus?: string | null
    }
  }>
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
      ['contrato.dia', 'Dia de emissao'],
      ['contrato.mes', 'Mes de emissao'],
      ['contrato.ano', 'Ano de emissao'],
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
    label: 'Segundo comprador',
    variables: [
      ['segundo_comprador.nome', 'Nome'],
      ['segundo_comprador.email', 'Email'],
      ['segundo_comprador.cpf', 'CPF'],
      ['segundo_comprador.rg', 'RG'],
      ['segundo_comprador.endereco', 'Endereco'],
      ['segundo_comprador.nascimento', 'Data de nascimento'],
      ['segundo_comprador.profissao', 'Profissao'],
      ['segundo_comprador.naturalidade', 'Naturalidade'],
      ['segundo_comprador.estado_civil', 'Estado civil'],
      ['segundo_comprador.vinculo', 'Vinculo com o comprador principal'],
      ['compradores.descricao', 'Descricao conjunta dos compradores'],
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
      ['venda.valor_total_numero', 'Valor total sem R$'],
      ['venda.valor_total_extenso', 'Valor total por extenso'],
      ['venda.entrada', 'Entrada'],
      ['venda.entrada_numero', 'Entrada sem R$'],
      ['venda.entrada_extenso', 'Entrada por extenso'],
      ['venda.entrada_percentual', 'Percentual da entrada'],
      ['venda.numero_parcelas_entrada', 'Numero de parcelas da entrada'],
      ['venda.primeiro_vencimento_entrada', 'Primeiro vencimento da entrada'],
      ['venda.valor_parcela_entrada', 'Valor de cada parcela da entrada'],
      ['venda.saldo', 'Saldo'],
      ['venda.saldo_numero', 'Saldo sem R$'],
      ['venda.saldo_extenso', 'Saldo por extenso'],
      ['venda.numero_parcelas', 'Numero de parcelas'],
      ['venda.numero_parcelas_extenso', 'Numero de parcelas por extenso'],
      ['venda.valor_parcela', 'Valor da parcela'],
      ['venda.valor_parcela_numero', 'Valor da parcela sem R$'],
      ['venda.valor_parcela_extenso', 'Valor da parcela por extenso'],
      ['venda.primeiro_vencimento', 'Primeira parcela do saldo'],
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

export function isOptionalDocumentVariable(variable: string, sale: TemplateSale) {
  if (optionalVariables.has(variable)) return true
  if (!variable.startsWith('custom.')) return false
  const key = variable.slice(7)
  return Boolean(
    sale.lot.block.development?.company?.documentVariables
      ?.some((item) => item.key === key && !item.required),
  )
}

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

function formatCurrencyNumber(value: number) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function integerToWords(value: number): string {
  const integer = Math.trunc(Math.abs(value))
  if (integer === 0) return 'zero'

  const units = ['', 'um', 'dois', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
  const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
  const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

  const underThousand = (part: number) => {
    if (part === 100) return 'cem'
    const words: string[] = []
    const hundred = Math.trunc(part / 100)
    const remainder = part % 100
    if (hundred) words.push(hundreds[hundred])
    if (remainder >= 10 && remainder <= 19) {
      words.push(teens[remainder - 10])
    } else {
      const ten = Math.trunc(remainder / 10)
      const unit = remainder % 10
      if (ten) words.push(tens[ten])
      if (unit) words.push(units[unit])
    }
    return words.join(' e ')
  }

  const groups = [
    { size: 1_000_000_000, singular: 'bilhao', plural: 'bilhoes' },
    { size: 1_000_000, singular: 'milhao', plural: 'milhoes' },
    { size: 1_000, singular: 'mil', plural: 'mil' },
  ]
  let remainder = integer
  const parts: string[] = []

  for (const group of groups) {
    const quantity = Math.trunc(remainder / group.size)
    if (!quantity) continue
    remainder %= group.size
    if (group.size === 1_000 && quantity === 1) {
      parts.push('mil')
    } else {
      parts.push(`${underThousand(quantity)} ${quantity === 1 ? group.singular : group.plural}`)
    }
  }
  if (remainder) parts.push(underThousand(remainder))

  return parts.join(remainder > 0 && remainder < 100 ? ' e ' : ', ')
}

function currencyToWords(value: number) {
  const centsValue = Math.round(Math.abs(value) * 100)
  const reais = Math.trunc(centsValue / 100)
  const cents = centsValue % 100
  const parts: string[] = []

  if (reais > 0) {
    const currencyName = reais === 1 ? 'real' : 'reais'
    const separator = reais >= 1_000_000 && reais % 1_000_000 === 0 ? ' de ' : ' '
    parts.push(`${integerToWords(reais)}${separator}${currencyName}`)
  }
  if (cents > 0) {
    parts.push(`${integerToWords(cents)} ${cents === 1 ? 'centavo' : 'centavos'}`)
  }

  return parts.length > 0 ? parts.join(' e ') : 'zero reais'
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

export function validateDocumentVariables(variables: string[], customKeys: string[] = []) {
  const allowedCustomVariables = new Set(customKeys.map((key) => `custom.${key}`))
  return {
    variables: [...new Set(variables)],
    customVariables: [...new Set(variables.filter((variable) => variable.startsWith('custom.')))],
    unknownVariables: [...new Set(variables.filter(
      (variable) => variable !== 'quebra_pagina' && !knownVariables.has(variable) && !allowedCustomVariables.has(variable),
    ))],
  }
}

export function getDocumentValues(sale: TemplateSale, contractNumber: string, generatedAt: Date): Record<string, string> {
  const development = sale.lot.block.development
  const settings = development?.contractSettings
  const totalValue = moneyToNumber(sale.totalValue)
  const downPayment = moneyToNumber(sale.downPayment)
  const installmentValue = moneyToNumber(sale.installmentValue)
  const balance = Math.max(totalValue - downPayment, 0)
  const participant = sale.participants?.[0]
  const coBuyer = participant?.user
  const relationshipLabel = participant?.relationshipType === 'spouse' ? 'Conjuge' : participant?.relationshipType === 'partner' ? 'Companheiro(a)' : participant ? 'Segundo comprador independente' : ''
  const buyersDescription = !coBuyer ? sale.user.name : participant?.relationshipType === 'spouse' ? `${sale.user.name}, casado(a) com ${coBuyer.name}` : participant?.relationshipType === 'partner' ? `${sale.user.name}, em uniao estavel com ${coBuyer.name}` : `${sale.user.name} e ${coBuyer.name}, compradores independentes`

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
    'contrato.dia': generatedAt.toLocaleDateString('pt-BR', { day: '2-digit' }),
    'contrato.mes': generatedAt.toLocaleDateString('pt-BR', { month: 'long' }),
    'contrato.ano': generatedAt.toLocaleDateString('pt-BR', { year: 'numeric' }),
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
    'segundo_comprador.nome': coBuyer?.name ?? '',
    'segundo_comprador.email': coBuyer?.email ?? '',
    'segundo_comprador.cpf': coBuyer?.cpf ?? '',
    'segundo_comprador.rg': coBuyer?.rg ?? '',
    'segundo_comprador.endereco': coBuyer?.address ?? '',
    'segundo_comprador.nascimento': formatDate(coBuyer?.birthDate),
    'segundo_comprador.profissao': coBuyer?.profession ?? '',
    'segundo_comprador.naturalidade': coBuyer?.birthplace ?? '',
    'segundo_comprador.estado_civil': coBuyer?.maritalStatus ?? '',
    'segundo_comprador.vinculo': relationshipLabel,
    'compradores.descricao': buyersDescription,
    'lote.numero': sale.lot.identifier,
    'lote.quadra': sale.lot.block.identifier,
    'lote.area': formatNumber(sale.lot.totalArea, ' m2'),
    'lote.frente': formatNumber(sale.lot.front, ' m'),
    'lote.fundo': formatNumber(sale.lot.back, ' m'),
    'lote.lateral_esquerda': formatNumber(sale.lot.leftSide, ' m'),
    'lote.lateral_direita': formatNumber(sale.lot.rightSide, ' m'),
    'venda.valor_total': formatCurrency(totalValue),
    'venda.valor_total_numero': formatCurrencyNumber(totalValue),
    'venda.valor_total_extenso': currencyToWords(totalValue),
    'venda.entrada': formatCurrency(downPayment),
    'venda.entrada_numero': formatCurrencyNumber(downPayment),
    'venda.entrada_extenso': currencyToWords(downPayment),
    'venda.entrada_percentual': totalValue > 0
      ? `${formatNumber((downPayment / totalValue) * 100)}%`
      : '',
    'venda.numero_parcelas_entrada': String(sale.downPaymentInstallmentCount ?? 1),
    'venda.valor_parcela_entrada': formatCurrency(downPayment / Math.max(sale.downPaymentInstallmentCount ?? 1, 1)),
    'venda.primeiro_vencimento_entrada': formatDate(sale.downPaymentFirstDueDate),
    'venda.saldo': formatCurrency(balance),
    'venda.saldo_numero': formatCurrencyNumber(balance),
    'venda.saldo_extenso': currencyToWords(balance),
    'venda.numero_parcelas': String(sale.installmentCount),
    'venda.numero_parcelas_extenso': integerToWords(sale.installmentCount),
    'venda.valor_parcela': formatCurrency(installmentValue),
    'venda.valor_parcela_numero': formatCurrencyNumber(installmentValue),
    'venda.valor_parcela_extenso': currencyToWords(installmentValue),
    'venda.primeiro_vencimento': formatDate(sale.firstDueDate),
    'venda.reajuste': sale.annualAdjustment ? 'Com reajuste anual.' : 'Sem reajuste anual.',
    'proposta.observacoes': sale.proposal?.notes ?? '',
    ...customDefaults,
    ...customOverrides,
  } satisfies Record<string, string>
}
