import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@/app/generated/prisma'
import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, financialDevelopmentAccessWhere } from '@/lib/access-control'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { createFinancialAuditLog } from '@/lib/payments/audit'
import { buildSettlementSnapshot, snapshotToken } from '@/lib/partner-settlement-data'
import { SettlementError, monthPeriod, text, participants, legacyParticipant, normalizeSnapshot, participantSummaries, validatePaidAllocations, recurringCosts, expenses, adjustments, amount, validDate, proofUrl, paymentSummary, type SettlementSnapshot } from '@/lib/partner-settlements'

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue

function failure(error: unknown) {
  if (error instanceof SettlementError) return NextResponse.json({ error: error.message }, { status: error.status })
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null
  if (code === 'P2002' || code === 'P2034') return NextResponse.json({ error: 'Os dados foram atualizados em outra operação. Atualize a tela e tente novamente.' }, { status: 409 })
  console.error('Partner settlements:', error)
  return NextResponse.json({ error: 'Não foi possível processar a distribuição.' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  try {
    const developmentId = req.nextUrl.searchParams.get('developmentId')
    const month = req.nextUrl.searchParams.get('month') || ''
    monthPeriod(month)
    const developments = await prisma.development.findMany({ where: financialDevelopmentAccessWhere(auth.session.user.id), select: { id: true, name: true }, orderBy: { name: 'asc' } })
    const development = developmentId ? developments.find((item) => item.id === developmentId) : developments[0]
    if (!development) return developmentId ? forbiddenResponse() : NextResponse.json({ developments, development: null })
    const result = await prisma.$transaction(async (tx) => {
      const agreement = await tx.partnerAgreement.findUnique({ where: { developmentId: development.id } })
      const settlement = await tx.partnerSettlement.findUnique({ where: { developmentId_month: { developmentId: development.id, month } }, include: { payments: { orderBy: [{ paidAt: 'desc' }, { id: 'asc' }] }, revisions: { select: { id: true, number: true, reason: true, closedAt: true, createdAt: true }, orderBy: { number: 'desc' } } } })
      const history = await tx.partnerSettlement.findMany({ where: { developmentId: development.id }, select: { id: true, month: true, status: true, participants: true, partnerAmount: true, payments: { select: { amount: true } } }, orderBy: { month: 'desc' } })
      const live = settlement ? await buildSettlementSnapshot(tx, development.id, development.name, settlement) : null
      const snapshot = settlement?.status === 'closed' ? normalizeSnapshot(settlement.snapshot) : live
      return {
        agreement, settlement, snapshot,
        allocations: settlement && snapshot ? participantSummaries(snapshot, settlement.payments) : [],
        previewToken: live ? snapshotToken(live) : null,
        sourceChanged: settlement?.status === 'closed' && snapshot && live ? snapshotToken(snapshot) !== snapshotToken(live) : false,
        payment: settlement && snapshot ? paymentSummary(snapshot.partnerAmount, settlement.payments) : null,
        history: history.map((item) => ({ ...item, participants: undefined, participantCount: Array.isArray(item.participants) ? item.participants.length : 1, payments: undefined, payment: item.status === 'closed' ? paymentSummary(Number(item.partnerAmount), item.payments) : null })),
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
    return NextResponse.json({ developments, development, canEdit: await hasDevelopmentPermission(auth.session.user.id, development.id, 'issuePayments'), ...result })
  } catch (error) { return failure(error) }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  try {
    let data: Record<string, unknown>
    try { data = await req.json() } catch { throw new SettlementError('Dados inválidos.') }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new SettlementError('Dados inválidos.')
    const developmentId = text(data.developmentId, 'o empreendimento')
    if (!(await hasDevelopmentPermission(auth.session.user.id, developmentId, 'issuePayments'))) return forbiddenResponse()
    const development = await prisma.development.findFirst({ where: { id: developmentId, deletedAt: null }, select: { id: true, name: true, companyId: true } })
    if (!development) return forbiddenResponse()
    const result = await prisma.$transaction(async (tx) => {
      const audit = (action: string, entityId: string, metadata: unknown) => createFinancialAuditLog(tx, { companyId: development.companyId, actorId: auth.session.user.id, action, entityId, entityType: 'partner_settlement', metadata })
      if (data.action === 'agreement') {
        const existing = await tx.partnerAgreement.findUnique({ where: { developmentId } })
        if (existing && data.version !== existing.version) throw new SettlementError('O acordo foi alterado. Atualize a tela.', 409)
        if (data.participants === undefined && existing && Array.isArray(existing.participants) && existing.participants.length > 1) throw new SettlementError('Atualize a tela para editar as regras com vários participantes.', 409)
        const recipients = participants(data.participants ?? legacyParticipant({ partnerName: text(data.partnerName, 'o nome do participante'), percentage: data.percentage, pixKey: text(data.pixKey ?? '', 'a chave Pix', false) }))
        const values = { participants: json(recipients), partnerName: recipients[0].name, pixKey: recipients.length === 1 ? recipients[0].pixKey : '', percentage: recipients.reduce((sum, item) => sum + item.percentage, 0), defaultCosts: json(recurringCosts(data.defaultCosts ?? data.recurringCosts ?? [])) }
        const agreement = await tx.partnerAgreement.upsert({ where: { developmentId }, create: { developmentId, ...values }, update: { ...values, version: { increment: 1 } } })
        await audit('partner_agreement_saved', agreement.id, { developmentId, ...values })
        return { id: agreement.id }
      }
      const month = text(data.month, 'o mês')
      const period = monthPeriod(month)
      if (data.action === 'create') {
        const agreement = await tx.partnerAgreement.findUnique({ where: { developmentId } })
        if (!agreement) throw new SettlementError('Configure as regras de distribuição primeiro.')
        const settlement = await tx.partnerSettlement.create({ data: {
          developmentId, month, participants: json(participants(agreement.participants)), partnerName: agreement.partnerName, pixKey: agreement.pixKey, percentage: agreement.percentage,
          expenses: json(recurringCosts(agreement.defaultCosts).map((cost) => ({ ...cost, paidAt: period.lastDate, proofUrl: '' }))),
          createdById: auth.session.user.id,
        } })
        await audit('partner_settlement_created', settlement.id, { developmentId, month })
        return { id: settlement.id }
      }
      const settlement = await tx.partnerSettlement.findUnique({ where: { developmentId_month: { developmentId, month } }, include: { payments: true } })
      if (!settlement) throw new SettlementError('Fechamento não encontrado.', 404)
      const configured = settlement.participants as unknown as { id: string }[]
      const participantId = data.action === 'payment' ? (data.participantId === undefined && configured.length === 1 ? configured[0].id : text(data.participantId, 'o participante do pagamento')) : ''
      // A repeated payment request must never duplicate a transfer record.
      if (data.action === 'payment' && typeof data.paymentId === 'string') {
        const existing = await tx.partnerPayment.findUnique({ where: { id: data.paymentId } })
        if (existing) {
          if (existing.settlementId !== settlement.id || existing.participantId !== participantId || Number(existing.amount) !== amount(data.amount) || existing.paidAt.getTime() !== validDate(data.paidAt).getTime() || (existing.proofUrl || '') !== proofUrl(data.proofUrl, developmentId) || (existing.notes || '') !== text(data.notes ?? '', 'a observação', false, 2000)) throw new SettlementError('Identificador de pagamento já utilizado.', 409)
          return { id: existing.id }
        }
      }
      if (!Number.isInteger(data.version) || data.version !== settlement.version) throw new SettlementError('O fechamento foi atualizado. Atualize a tela antes de continuar.', 409)
      if (data.action === 'reopen') {
        if (settlement.status !== 'closed' || !settlement.snapshot || !settlement.closedAt) throw new SettlementError('Somente um mês fechado pode ser reaberto.', 409)
        const reason = text(data.reason, 'o motivo da reabertura', true, 2000)
        const number = await tx.partnerSettlementRevision.count({ where: { settlementId: settlement.id } }) + 1
        const revision = await tx.partnerSettlementRevision.create({ data: {
          settlementId: settlement.id, number, snapshot: settlement.snapshot, payments: json(settlement.payments),
          closedAt: settlement.closedAt, reason, createdById: auth.session.user.id,
        } })
        await tx.partnerSettlement.update({ where: { id: settlement.id }, data: { status: 'draft', snapshot: Prisma.DbNull, closedAt: null, closedById: null, version: { increment: 1 } } })
        await audit('partner_settlement_reopened', settlement.id, { reason, revisionId: revision.id, revisionNumber: number })
      } else if (data.action === 'applyAgreement') {
        if (settlement.status !== 'draft') throw new SettlementError('Reabra o fechamento antes de alterar o acordo.', 409)
        const agreement = await tx.partnerAgreement.findUnique({ where: { developmentId } })
        if (!agreement) throw new SettlementError('Configure as regras de distribuição primeiro.')
        const recipients = participants(agreement.participants)
        if (settlement.payments.some((payment) => !recipients.some((item) => item.id === payment.participantId))) throw new SettlementError('Não é possível remover deste mês um participante que já recebeu pagamentos. Mantenha-o nas regras para atualizar este rascunho.', 409)
        const values = { participants: json(recipients), partnerName: agreement.partnerName, pixKey: agreement.pixKey, percentage: agreement.percentage }
        await tx.partnerSettlement.update({ where: { id: settlement.id }, data: { ...values, version: { increment: 1 } } })
        await audit('partner_settlement_agreement_updated', settlement.id, values)
      } else if (data.action === 'save') {
        if (settlement.status !== 'draft') throw new SettlementError('Fechamentos confirmados não podem ser editados.', 409)
        const values = { expenses: json(expenses(data.expenses, month, developmentId)), adjustments: json(adjustments(data.adjustments, month)) }
        await tx.partnerSettlement.update({ where: { id: settlement.id }, data: { ...values, version: { increment: 1 } } })
        await audit('partner_settlement_draft_saved', settlement.id, values)
      } else if (data.action === 'close') {
        if (settlement.status !== 'draft') throw new SettlementError('Este mês já está fechado.', 409)
        if (period.end > new Date()) throw new SettlementError('Aguarde o fim do mês para confirmar o fechamento.')
        const snapshot = await buildSettlementSnapshot(tx, developmentId, development.name, settlement)
        if (snapshotToken(snapshot) !== data.previewToken) throw new SettlementError('Recebimentos, comissões ou custos mudaram. Atualize e confira o demonstrativo antes de fechar.', 409)
        const { receiptsTotal, commissionsTotal, costsTotal, adjustmentsTotal, netAmount, partnerAmount } = snapshot
        validatePaidAllocations(snapshot, settlement.payments)
        await tx.partnerSettlement.update({ where: { id: settlement.id }, data: { status: 'closed', snapshot: json(snapshot), receiptsTotal, commissionsTotal, costsTotal, adjustmentsTotal, netAmount, partnerAmount, closedAt: new Date(), closedById: auth.session.user.id, version: { increment: 1 } } })
        await audit('partner_settlement_closed', settlement.id, snapshot)
      } else if (data.action === 'payment') {
        if (settlement.status !== 'closed') throw new SettlementError('Confirme o fechamento antes de registrar o pagamento.', 409)
        const value = amount(data.amount)
        const snapshot = normalizeSnapshot(settlement.snapshot)
        const recipient = snapshot.participants.find((item) => item.id === participantId)
        if (!recipient) throw new SettlementError('Participante não encontrado neste fechamento.')
        const summary = paymentSummary(recipient.amount, settlement.payments.filter((item) => item.participantId === participantId))
        if (value > summary.remaining) throw new SettlementError('O valor excede o saldo deste participante.')
        const paidAt = validDate(data.paidAt)
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
        if (String(data.paidAt) > today) throw new SettlementError('A data do Pix não pode estar no futuro.')
        const id = text(data.paymentId, 'o identificador do pagamento')
        if (!/^[a-f0-9-]{36}$/.test(id)) throw new SettlementError('Identificador de pagamento inválido.')
        const payment = await tx.partnerPayment.create({ data: { id, settlementId: settlement.id, participantId, participantName: recipient.name, amount: value, paidAt, proofUrl: proofUrl(data.proofUrl, developmentId) || null, notes: text(data.notes ?? '', 'a observação', false, 2000) || null, createdById: auth.session.user.id } })
        await tx.partnerSettlement.update({ where: { id: settlement.id }, data: { version: { increment: 1 } } })
        await audit('partner_payment_recorded', settlement.id, { paymentId: payment.id, participantId, participantName: recipient.name, amount: value, paidAt, proofUrl: payment.proofUrl })
      } else throw new SettlementError('Operação inválida.')
      return { id: settlement.id }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 })
    return NextResponse.json(result)
  } catch (error) { return failure(error) }
}
