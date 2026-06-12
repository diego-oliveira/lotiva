type CommercialSettings = {
  minDownPaymentPercentage: number
  maxInstallments: number
  defaultInterestRate: number
  interestCalculation: string
  correctionIndex: string
  correctionFrequency: string
  allowCustomTerms: boolean
}

type ProposalTerms = {
  basePrice: number
  salePrice: number
  downPayment: number
  installmentCount: number
  interestRate: number
  interestCalculation: string
  correctionIndex: string
  correctionFrequency: string
}

const FLOAT_TOLERANCE = 0.001

function differs(left: number, right: number) {
  return Math.abs(left - right) > FLOAT_TOLERANCE
}

export function evaluateProposalTerms(settings: CommercialSettings, terms: ProposalTerms) {
  const reasons: string[] = []
  const minimumDownPayment = (terms.salePrice * settings.minDownPaymentPercentage) / 100

  if (terms.salePrice + FLOAT_TOLERANCE < terms.basePrice) {
    reasons.push('Valor de venda abaixo do preco-base do lote')
  }
  if (terms.downPayment + FLOAT_TOLERANCE < minimumDownPayment) {
    reasons.push(`Entrada abaixo do minimo de ${settings.minDownPaymentPercentage}%`)
  }
  if (terms.installmentCount > settings.maxInstallments) {
    reasons.push(`Parcelamento acima do maximo de ${settings.maxInstallments} parcelas`)
  }
  if (differs(terms.interestRate, settings.defaultInterestRate)) {
    reasons.push('Taxa de juros diferente da configuracao comercial')
  }
  if (terms.interestCalculation !== settings.interestCalculation) {
    reasons.push('Calculo de juros diferente da configuracao comercial')
  }
  if (terms.correctionIndex !== settings.correctionIndex) {
    reasons.push('Indice de correcao diferente da configuracao comercial')
  }
  if (terms.correctionFrequency !== settings.correctionFrequency) {
    reasons.push('Frequencia de correcao diferente da configuracao comercial')
  }

  return {
    reasons,
    hasException: reasons.length > 0,
    canSubmit: reasons.length === 0 || settings.allowCustomTerms,
    status: reasons.length === 0 ? 'approved' : 'pending_approval',
  }
}

export function evaluateDirectSaleTerms(
  settings: Pick<CommercialSettings, 'minDownPaymentPercentage' | 'maxInstallments'>,
  terms: Pick<ProposalTerms, 'basePrice' | 'downPayment' | 'installmentCount'>,
) {
  const reasons: string[] = []
  const minimumDownPayment = (terms.basePrice * settings.minDownPaymentPercentage) / 100

  if (!Number.isFinite(terms.downPayment)) {
    reasons.push('Valor de entrada invalido')
  }
  if (!Number.isInteger(terms.installmentCount)) {
    reasons.push('Numero de parcelas invalido')
  }
  if (terms.downPayment + FLOAT_TOLERANCE < minimumDownPayment) {
    reasons.push(`Entrada minima: ${settings.minDownPaymentPercentage}%`)
  }
  if (terms.downPayment > terms.basePrice + FLOAT_TOLERANCE) {
    reasons.push('Entrada maior que o valor do lote')
  }
  if (terms.installmentCount < 1) {
    reasons.push('Informe pelo menos uma parcela')
  }
  if (terms.installmentCount > settings.maxInstallments) {
    reasons.push(`Maximo de ${settings.maxInstallments} parcelas`)
  }

  return {
    reasons,
    isValid: reasons.length === 0,
    minimumDownPayment,
  }
}

export function calculateInstallment(
  balance: number,
  installmentCount: number,
  monthlyInterestRate: number,
  interestCalculation: string,
) {
  if (balance <= 0 || installmentCount <= 0) return 0

  const monthlyRate = monthlyInterestRate / 100
  if (monthlyRate <= 0 || interestCalculation === 'none') return balance / installmentCount
  if (interestCalculation === 'simple') return (balance * (1 + monthlyRate * installmentCount)) / installmentCount

  const factor = Math.pow(1 + monthlyRate, installmentCount)
  return (balance * monthlyRate * factor) / (factor - 1)
}
