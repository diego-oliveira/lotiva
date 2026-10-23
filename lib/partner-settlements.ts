import { Prisma } from '@/app/generated/prisma'
import { addMoney, decimal, moneyToNumber } from '@/lib/money'
import { parsePaymentDate } from '@/lib/payment-dates'

export type RecurringCost = { description: string; amount: number; category?: string }
export type DistributionParticipant = { id: string; kind: 'person' | 'company'; name: string; percentage: number; pixKey: string }
export type AllocatedParticipant = DistributionParticipant & { amount: number }
export type SettlementExpense = RecurringCost & { paidAt: string; proofUrl: string }
export type SettlementAdjustment = { description: string; amount: number; referenceMonth: string }
export type SettlementReceipt = { id: string; saleId: string; description: string; paidAt: string; amount: number }
export type SettlementSnapshot = {
  developmentName: string
  participants: AllocatedParticipant[]
  totalPercentage: number
  operationAmount: number
  month: string
  receipts: SettlementReceipt[]
  commissions: SettlementReceipt[]
  expenses: SettlementExpense[]
  adjustments: SettlementAdjustment[]
  receiptsTotal: number
  commissionsTotal: number
  costsTotal: number
  adjustmentsTotal: number
  netAmount: number
  partnerAmount: number
}

export class SettlementError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export function monthPeriod(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 2000 || Number(month.slice(0, 4)) > 2100) {
    throw new SettlementError('Informe um mês válido entre 2000 e 2100.')
  }
  const [year, number] = month.split('-').map(Number)
  // Financial periods follow Bahia time, independently of the server timezone.
  const start = new Date(`${month}-01T00:00:00-03:00`)
  const end = new Date(Date.UTC(year, number, 1, 3))
  const lastDay = new Date(Date.UTC(year, number, 0)).getUTCDate()
  return { start, end, lastDate: `${month}-${lastDay}` }
}

export function validDate(value: unknown) {
  try { return parsePaymentDate(value) }
  catch { throw new SettlementError('Informe uma data válida.') }
}

export function text(value: unknown, label: string, required = true, max = 300) {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) throw new SettlementError(`Informe ${label}.`)
  return value.trim()
}

export function amount(value: unknown, allowNegative = false, allowZero = false) {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '') throw new SettlementError('Informe um valor válido.')
  const number = Number(value)
  if (!Number.isFinite(number) || Math.abs(number) > 999_999_999_999 || (!allowNegative && number < 0)) throw new SettlementError('Informe um valor válido.')
  const result = moneyToNumber(number)
  if (!allowZero && result === 0) throw new SettlementError('O valor deve ser diferente de zero.')
  return result
}

export function percentage(value: unknown) {
  const number = Number(value)
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '' || !Number.isFinite(number) || number <= 0 || number > 100) throw new SettlementError('A participação deve ser maior que 0% e no máximo 100%.')
  const result = new Prisma.Decimal(number).toDecimalPlaces(4).toNumber()
  if (result <= 0) throw new SettlementError('A participação mínima é 0,0001%.')
  return result
}

export function proofUrl(value: unknown, developmentId: string) {
  if (!value) return ''
  const url = text(value, 'um comprovante válido', true, 500)
  const prefix = `/api/partner-settlements/proofs?developmentId=${encodeURIComponent(developmentId)}&file=`
  if (!url.startsWith(prefix) || !/^[a-f0-9-]{36}\.(pdf|png|jpg|webp)$/.test(url.slice(prefix.length))) throw new SettlementError('Comprovante inválido para este empreendimento.')
  return url
}

function rows(value: unknown) {
  if (!Array.isArray(value) || value.length > 100) throw new SettlementError('Informe uma lista com até 100 itens.')
  if (value.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) throw new SettlementError('Item inválido.')
  return value as Record<string, unknown>[]
}

export function recurringCosts(value: unknown): RecurringCost[] {
  return rows(value).map((row) => ({ description: text(row.description, 'a descrição do custo'), category: text(row.category ?? 'Outros', 'a categoria', false, 60) || 'Outros', amount: amount(row.amount) }))
}

export function expenses(value: unknown, month: string, developmentId: string): SettlementExpense[] {
  return rows(value).map((row) => {
    const paidAt = text(row.paidAt, 'a data do custo')
    validDate(paidAt)
    if (!paidAt.startsWith(`${month}-`)) throw new SettlementError('A data do custo deve pertencer ao mês do fechamento.')
    return { description: text(row.description, 'a descrição do custo'), category: text(row.category ?? 'Outros', 'a categoria', false, 60) || 'Outros', amount: amount(row.amount), paidAt, proofUrl: proofUrl(row.proofUrl, developmentId) }
  })
}

export function adjustments(value: unknown, month: string): SettlementAdjustment[] {
  return rows(value).map((row) => {
    const referenceMonth = text(row.referenceMonth, 'o mês de origem do ajuste')
    monthPeriod(referenceMonth)
    if (referenceMonth >= month) throw new SettlementError('O ajuste deve se referir a um mês anterior ao fechamento.')
    return { description: text(row.description, 'o motivo do ajuste'), amount: amount(row.amount, true), referenceMonth }
  })
}

export function participants(value: unknown): DistributionParticipant[] {
  const result = rows(value).map((row) => {
    const id = text(row.id, 'o identificador do participante')
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new SettlementError('Identificador de participante inválido.')
    if (row.kind !== 'person' && row.kind !== 'company') throw new SettlementError('Selecione pessoa ou empresa para cada participante.')
    return { id, kind: row.kind, name: text(row.name, 'o nome do participante'), percentage: percentage(row.percentage), pixKey: text(row.pixKey ?? '', 'a chave Pix', false) } as DistributionParticipant
  })
  if (!result.length) throw new SettlementError('Adicione pelo menos um participante.')
  if (new Set(result.map((item) => item.id)).size !== result.length) throw new SettlementError('Há participantes com o mesmo identificador.')
  const total = result.reduce((sum, item) => sum.plus(item.percentage), new Prisma.Decimal(0))
  if (total.gt(100)) throw new SettlementError('A soma das participações não pode ultrapassar 100%.')
  return result
}

export function legacyParticipant(value: { partnerName: string; percentage: unknown; pixKey: string }): DistributionParticipant[] {
  return [{ id: 'legacy', kind: 'person', name: value.partnerName, percentage: Number(value.percentage), pixKey: value.pixKey }]
}

type CalculationInput = Pick<SettlementSnapshot, 'developmentName' | 'month' | 'receipts' | 'commissions' | 'expenses' | 'adjustments'> & (
  { participants: DistributionParticipant[] } | { partnerName: string; percentage: number; pixKey: string }
)

export function calculateSettlement(input: CalculationInput): SettlementSnapshot {
  const recipients = participants('participants' in input ? input.participants : legacyParticipant(input))
  const sum = (items: { amount: number }[]) => addMoney(...items.map((item) => item.amount))
  const receiptsTotal = sum(input.receipts)
  const commissionsTotal = sum(input.commissions)
  const costsTotal = sum(input.expenses)
  const adjustmentsTotal = sum(input.adjustments)
  const netAmount = receiptsTotal.minus(commissionsTotal).minus(costsTotal).plus(adjustmentsTotal).toDecimalPlaces(2)
  const positiveNet = Prisma.Decimal.max(netAmount, 0)
  const totalPercentage = recipients.reduce((sum, item) => sum.plus(item.percentage), new Prisma.Decimal(0))
  const target = positiveNet.times(totalPercentage).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
  // Allocate leftover cents by largest remainder, with stable identity as the
  // tie-breaker. Even a 100% split of one cent must never distribute two cents.
  const shares = recipients.map((item) => {
    const exact = positiveNet.times(item.percentage).div(100)
    const rounded = exact.toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN)
    return { item, amount: rounded, remainder: exact.minus(rounded) }
  })
  let cents = target.minus(addMoney(...shares.map((item) => item.amount))).times(100).toNumber()
  const ordered = [...shares].sort((left, right) => right.remainder.comparedTo(left.remainder) || left.item.id.localeCompare(right.item.id))
  for (const share of ordered) { if (cents-- <= 0) break; share.amount = share.amount.plus('0.01') }
  return {
    developmentName: input.developmentName, month: input.month,
    participants: shares.map((share) => ({ ...share.item, amount: share.amount.toNumber() })),
    totalPercentage: totalPercentage.toNumber(), operationAmount: netAmount.minus(target).toNumber(),
    receipts: input.receipts, commissions: input.commissions,
    expenses: input.expenses.map((item) => ({ ...item, category: item.category || 'Outros' })), adjustments: input.adjustments,
    receiptsTotal: receiptsTotal.toNumber(), commissionsTotal: commissionsTotal.toNumber(), costsTotal: costsTotal.toNumber(), adjustmentsTotal: adjustmentsTotal.toNumber(), netAmount: netAmount.toNumber(), partnerAmount: target.toNumber(),
  }
}

/** Adapt historical statements on read without modifying their stored JSON or amounts. */
export function normalizeSnapshot(value: unknown): SettlementSnapshot {
  const snapshot = value as SettlementSnapshot & { partnerName?: string; percentage?: number; pixKey?: string }
  const recipients = snapshot.participants?.length ? snapshot.participants : [{ ...legacyParticipant({ partnerName: snapshot.partnerName || '', percentage: snapshot.percentage || 0, pixKey: snapshot.pixKey || '' })[0], amount: snapshot.partnerAmount }]
  return {
    developmentName: snapshot.developmentName, month: snapshot.month, participants: recipients,
    totalPercentage: snapshot.totalPercentage ?? recipients.reduce((sum, item) => sum + Number(item.percentage), 0),
    operationAmount: snapshot.operationAmount ?? decimal(snapshot.netAmount).minus(snapshot.partnerAmount).toNumber(),
    receipts: snapshot.receipts, commissions: snapshot.commissions,
    expenses: snapshot.expenses.map((item) => ({ ...item, category: item.category || 'Outros' })), adjustments: snapshot.adjustments,
    receiptsTotal: snapshot.receiptsTotal, commissionsTotal: snapshot.commissionsTotal, costsTotal: snapshot.costsTotal, adjustmentsTotal: snapshot.adjustmentsTotal, netAmount: snapshot.netAmount, partnerAmount: snapshot.partnerAmount,
  }
}

export type DistributionPayment = { amount: number | Prisma.Decimal; participantId?: string | null }
export function participantSummaries(snapshot: SettlementSnapshot, payments: DistributionPayment[]) {
  return snapshot.participants.map((item) => ({ ...item, ...paymentSummary(item.amount, payments.filter((payment) => (payment.participantId || 'legacy') === item.id)) }))
}

export function validatePaidAllocations(snapshot: SettlementSnapshot, payments: DistributionPayment[]) {
  const ids = new Set(payments.map((item) => item.participantId || 'legacy'))
  for (const id of ids) {
    const paid = addMoney(...payments.filter((item) => (item.participantId || 'legacy') === id).map((item) => item.amount))
    const recipient = snapshot.participants.find((item) => item.id === id)
    if (paid.gt(recipient?.amount ?? 0)) throw new SettlementError(`A distribuição de ${recipient?.name || 'um participante já pago'} é menor que o valor pago. Confira as regras e os ajustes antes de fechar.`, 409)
  }
}

export function paymentSummary(partnerAmount: number, payments: { amount: number | Prisma.Decimal }[]) {
  const paid = addMoney(...payments.map((payment) => payment.amount))
  const remaining = Prisma.Decimal.max(decimal(partnerAmount).minus(paid), 0)
  return { paid: paid.toNumber(), remaining: remaining.toNumber(), status: remaining.isZero() ? 'paid' : paid.gt(0) ? 'partial' : 'pending' }
}
