import { NextResponse } from 'next/server'
import type { Prisma } from '@/app/generated/prisma'
import { forbiddenResponse, saleAccessWhere } from '@/lib/access-control'
import { requireAuthenticatedUser } from '@/lib/auth'
import { decimal, moneyToNumber, subtractMoney } from '@/lib/money'
import { createFinancialAuditLog } from '@/lib/payments/audit'
import { getPaymentProviderForConnection } from '@/lib/payments/factory'
import type { PaymentCharge } from '@/lib/payments/types'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }
type MatchType = 'exact' | 'correction'

const MAX_CHARGES_TO_SCAN = 500
const DATE_TOLERANCE_DAYS = 5
const CORRECTION_ABSOLUTE_TOLERANCE = 50
const CORRECTION_PERCENT_TOLERANCE = 0.1
const IMPORTABLE_STATUSES = new Set(['pending', 'confirmed', 'received', 'overdue'])

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function daysBetween(left: Date, right: Date) {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((Date.UTC(left.getUTCFullYear(), left.getUTCMonth(), left.getUTCDate()) -
    Date.UTC(right.getUTCFullYear(), right.getUTCMonth(), right.getUTCDate())) / msPerDay)
}

function isPaidStatus(status: PaymentCharge['status']) {
  return status === 'confirmed' || status === 'received'
}

function normalizeDocument(value?: string | null) {
  return (value || '').replace(/\D/g, '')
}

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function getChargeReference(charge: PaymentCharge) {
  return charge.externalReference?.trim() || `asaas-import:${charge.id}`
}

async function getAuthorizedSale(userId: string, saleId: string) {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, ...saleAccessWhere(userId) },
    include: {
      user: true,
      lot: {
        include: {
          block: {
            include: {
              development: true,
            },
          },
        },
      },
      receivables: {
        include: { externalCharges: true },
        orderBy: [
          { dueDate: 'asc' },
          { sequence: 'asc' },
        ],
      },
    },
  })
  const developmentId = sale?.lot.block.developmentId
  if (!sale || !developmentId || !(await hasDevelopmentPermission(userId, developmentId, 'reconcilePayments'))) {
    return null
  }
  return {
    sale,
    developmentId,
    companyId: sale.lot.block.development?.companyId,
  }
}

async function findActiveAsaasConnection(companyId: string, environment?: unknown) {
  const requestedEnvironment = environment === 'production'
    ? 'production'
    : environment === 'sandbox'
      ? 'sandbox'
      : null

  if (requestedEnvironment) {
    return prisma.paymentProviderConnection.findUnique({
      where: {
        companyId_provider_environment: {
          companyId,
          provider: 'asaas',
          environment: requestedEnvironment,
        },
      },
    })
  }

  return await prisma.paymentProviderConnection.findFirst({
    where: { companyId, provider: 'asaas', status: 'active', environment: 'production' },
  }) || prisma.paymentProviderConnection.findFirst({
    where: { companyId, provider: 'asaas', status: 'active', environment: 'sandbox' },
  })
}

async function listCustomerCharges(provider: Awaited<ReturnType<typeof getPaymentProviderForConnection>>['provider'], customerId: string) {
  const charges: PaymentCharge[] = []
  let offset = 0
  const limit = 100

  while (charges.length < MAX_CHARGES_TO_SCAN) {
    const result = await provider.listCharges({ customerId, offset, limit })
    charges.push(...result.charges)
    if (!result.hasMore || result.charges.length === 0) break
    offset += limit
  }

  return charges.slice(0, MAX_CHARGES_TO_SCAN)
}

function buildMatchPreview(input: {
  sale: NonNullable<Awaited<ReturnType<typeof getAuthorizedSale>>>['sale']
  connectionId: string
  charges: PaymentCharge[]
}) {
  const existingProviderIds = new Set(
    input.sale.receivables.flatMap((receivable) =>
      receivable.externalCharges
        .filter((charge) => charge.connectionId === input.connectionId)
        .map((charge) => charge.providerChargeId),
    ),
  )
  const importableCharges = input.charges.filter((charge) =>
    IMPORTABLE_STATUSES.has(charge.status) &&
    !charge.deleted &&
    !existingProviderIds.has(charge.id),
  )
  const availableReceivables = input.sale.receivables.filter((receivable) =>
    !receivable.externalCharges.some((charge) => charge.connectionId === input.connectionId),
  )

  const usedCharges = new Set<string>()
  const matches = availableReceivables.flatMap((receivable) => {
    const localAmount = moneyToNumber(receivable.amount)
    const dueDate = receivable.dueDate
    const candidates = importableCharges.flatMap((charge) => {
      if (usedCharges.has(charge.id)) return []
      const chargeDueDate = parseDate(charge.dueDate)
      if (!chargeDueDate) return []
      const dayDistance = Math.abs(daysBetween(dueDate, chargeDueDate))
      if (dayDistance > DATE_TOLERANCE_DAYS) return []

      const providerAmount = Number(charge.amount)
      if (!Number.isFinite(providerAmount)) return []
      const difference = Number((providerAmount - localAmount).toFixed(2))
      const exact = Math.abs(difference) <= 0.01
      const correction = difference > 0 &&
        (difference <= CORRECTION_ABSOLUTE_TOLERANCE || difference / localAmount <= CORRECTION_PERCENT_TOLERANCE)

      if (!exact && !correction) return []

      return [{
        charge,
        chargeDueDate,
        difference,
        providerAmount,
        matchType: exact ? 'exact' as MatchType : 'correction' as MatchType,
        score: (exact ? 1000 : 700) - dayDistance,
      }]
    }).sort((left, right) => right.score - left.score)

    const selected = candidates[0]
    if (!selected) return []
    usedCharges.add(selected.charge.id)
    return [{
      receivableId: receivable.id,
      receivableLabel: receivable.kind === 'down_payment' ? 'Entrada' : `Parcela ${receivable.sequence}`,
      kind: receivable.kind,
      sequence: receivable.sequence,
      dueDate: dateKey(receivable.dueDate),
      localAmount,
      providerChargeId: selected.charge.id,
      providerDueDate: selected.charge.dueDate,
      providerAmount: selected.providerAmount,
      difference: selected.difference,
      status: selected.charge.status,
      billingType: selected.charge.billingType,
      invoiceUrl: selected.charge.invoiceUrl || null,
      bankSlipUrl: selected.charge.bankSlipUrl || null,
      matchType: selected.matchType,
      note: selected.matchType === 'correction'
        ? 'Valor maior dentro da tolerancia de correcao.'
        : 'Valor e vencimento compativeis.',
    }]
  })

  const matchedReceivableIds = new Set(matches.map((match) => match.receivableId))
  const matchedChargeIds = new Set(matches.map((match) => match.providerChargeId))

  return {
    matches,
    unmatchedReceivables: availableReceivables
      .filter((receivable) => !matchedReceivableIds.has(receivable.id))
      .map((receivable) => ({
        receivableId: receivable.id,
        receivableLabel: receivable.kind === 'down_payment' ? 'Entrada' : `Parcela ${receivable.sequence}`,
        dueDate: dateKey(receivable.dueDate),
        amount: moneyToNumber(receivable.amount),
        status: receivable.status,
      })),
    unmatchedCharges: importableCharges
      .filter((charge) => !matchedChargeIds.has(charge.id))
      .map((charge) => ({
        providerChargeId: charge.id,
        dueDate: charge.dueDate,
        amount: Number(charge.amount),
        status: charge.status,
        invoiceUrl: charge.invoiceUrl || null,
        bankSlipUrl: charge.bankSlipUrl || null,
      })),
  }
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const actorId = auth.session.user.id
  const { id } = await params
  const authorized = await getAuthorizedSale(actorId, id)
  if (!authorized?.companyId) return forbiddenResponse()
  const companyId = authorized.companyId

  try {
    const data = await req.json().catch(() => ({}))
    const action = data.action === 'import' ? 'import' : 'preview'
    const connection = await findActiveAsaasConnection(companyId, data.environment)
    if (!connection || connection.status !== 'active') {
      return NextResponse.json(
        { error: 'A empresa ainda nao possui uma conta Asaas ativa.' },
        { status: 409 },
      )
    }

    const cpfCnpj = normalizeDocument(authorized.sale.user.cpf)
    if (!cpfCnpj) {
      return NextResponse.json(
        { error: 'O cliente desta venda precisa ter CPF/CNPJ para buscar cobrancas existentes no Asaas.' },
        { status: 422 },
      )
    }

    const payment = await getPaymentProviderForConnection(connection.id)
    const customer = await payment.provider.findCustomerByDocument(cpfCnpj)
    if (!customer) {
      return NextResponse.json(
        { error: 'Nenhum cliente com este CPF/CNPJ foi encontrado no Asaas.' },
        { status: 404 },
      )
    }

    await prisma.externalCustomer.upsert({
      where: {
        connectionId_userId: {
          connectionId: connection.id,
          userId: authorized.sale.userId,
        },
      },
      update: {
        providerCustomerId: customer.id,
        externalReference: customer.externalReference || `asaas-customer:${customer.id}`,
        status: 'active',
        lastSynchronizedAt: new Date(),
      },
      create: {
        connectionId: connection.id,
        userId: authorized.sale.userId,
        providerCustomerId: customer.id,
        externalReference: customer.externalReference || `asaas-customer:${customer.id}`,
        status: 'active',
      },
    })

    const charges = await listCustomerCharges(payment.provider, customer.id)
    const preview = buildMatchPreview({
      sale: authorized.sale,
      connectionId: connection.id,
      charges,
    })
    const payload = {
      connection: {
        id: connection.id,
        provider: connection.provider,
        environment: connection.environment,
      },
      customer: {
        id: customer.id,
        name: customer.name,
        cpfCnpj: customer.cpfCnpj,
      },
      scannedCharges: charges.length,
      ...preview,
    }

    if (action === 'preview') return NextResponse.json(payload)

    const chargesById = new Map(charges.map((charge) => [charge.id, charge]))
    const imported = await prisma.$transaction(async (tx) => {
      const created: Array<{ externalChargeId: string; receivableId: string; matchType: MatchType }> = []

      for (const match of preview.matches) {
        const charge = chargesById.get(match.providerChargeId)
        if (!charge) continue

        const existing = await tx.externalCharge.findUnique({
          where: {
            connectionId_providerChargeId: {
              connectionId: connection.id,
              providerChargeId: charge.id,
            },
          },
        })
        if (existing) continue

        const amount = decimal(charge.amount)
        const paid = isPaidStatus(charge.status)
        const paidAmount = paid ? decimal(charge.paidAmount || charge.amount) : decimal(0)
        const netPaidAmount = paid && charge.netAmount ? decimal(charge.netAmount) : null
        const feeAmount = paid && netPaidAmount ? subtractMoney(paidAmount, netPaidAmount) : null
        const providerPaymentDate = parseDate(charge.paymentDate)
        const providerCreditDate = parseDate(charge.creditDate)
        const dueDate = parseDate(charge.dueDate) || new Date()
        const receivableAmount = match.matchType === 'correction' ? amount : undefined

        const externalCharge = await tx.externalCharge.create({
          data: {
            connectionId: connection.id,
            billingCycleId: null,
            receivableId: match.receivableId,
            providerChargeId: charge.id,
            externalReference: getChargeReference(charge),
            billingType: charge.billingType,
            status: charge.status,
            amount,
            dueDate,
            invoiceUrl: charge.invoiceUrl,
            bankSlipUrl: charge.bankSlipUrl,
            providerPayload: jsonValue(charge),
            grossPaidAmount: paid ? paidAmount : null,
            netPaidAmount,
            feeAmount,
            providerPaymentDate,
            providerCreditDate,
            lastSynchronizedAt: new Date(),
          },
        })

        await tx.receivable.update({
          where: { id: match.receivableId },
          data: paid
            ? {
                amount: receivableAmount,
                paidAmount,
                balance: 0,
                status: 'paid',
                paidAt: providerPaymentDate || new Date(),
              }
            : {
                amount: receivableAmount,
                balance: match.matchType === 'correction' ? amount : undefined,
              },
        })

        await createFinancialAuditLog(tx, {
          companyId,
          actorId,
          action: 'external_charge_imported',
          entityType: 'external_charge',
          entityId: externalCharge.id,
          saleId: authorized.sale.id,
          receivableId: match.receivableId,
          externalChargeId: externalCharge.id,
          metadata: {
            provider: 'asaas',
            providerChargeId: charge.id,
            matchType: match.matchType,
            localAmount: match.localAmount,
            providerAmount: match.providerAmount,
            difference: match.difference,
            status: charge.status,
          },
        })

        if (match.matchType === 'correction') {
          await createFinancialAuditLog(tx, {
            companyId,
            actorId,
            action: 'receivable_amount_adjusted_from_provider',
            entityType: 'receivable',
            entityId: match.receivableId,
            saleId: authorized.sale.id,
            receivableId: match.receivableId,
            externalChargeId: externalCharge.id,
            metadata: {
              previousAmount: match.localAmount,
              adjustedAmount: match.providerAmount,
              difference: match.difference,
            },
          })
        }

        created.push({
          externalChargeId: externalCharge.id,
          receivableId: match.receivableId,
          matchType: match.matchType,
        })
      }

      return created
    })

    return NextResponse.json({ ...payload, imported }, { status: 201 })
  } catch (error) {
    return NextResponse.json({
      error: 'Nao foi possivel importar as cobrancas existentes do Asaas.',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    }, { status: 400 })
  }
}
