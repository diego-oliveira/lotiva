import type { Prisma, PrismaClient } from '@/app/generated/prisma'
import { decimal, subtractMoney } from '@/lib/money'
import type { PaymentCharge } from './types'
import { createFinancialAuditLog } from './audit'

type PaymentDatabase = PrismaClient | Prisma.TransactionClient

function parseDate(value?: string) {
  if (!value) return null
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function paidStatus(status: PaymentCharge['status']) {
  return status === 'confirmed' || status === 'received'
}

function decimalOrNull(value?: string) {
  if (!value) return null
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  return decimal(value)
}

export async function synchronizeExternalCharge(input: {
  db: PaymentDatabase
  externalChargeId: string
  charge: PaymentCharge
  source: 'webhook' | 'reconciliation' | 'manual'
  eventAt?: Date | null
  actorId?: string | null
  providerPayload?: unknown
}) {
  const saved = await input.db.externalCharge.findUnique({
    where: { id: input.externalChargeId },
    include: {
      connection: true,
      receivable: {
        include: {
          sale: {
            include: {
              lot: { include: { block: { include: { development: true } } } },
            },
          },
          externalCharges: true,
        },
      },
    },
  })
  if (!saved) throw new Error('Cobranca externa nao encontrada.')
  if (input.eventAt && saved.lastEventAt && input.eventAt < saved.lastEventAt) {
    return { ignoredAsStale: true, externalCharge: saved }
  }

  const amount = decimal(input.charge.amount)
  const shouldStorePaidValues = paidStatus(input.charge.status)
  const grossPaidAmount = shouldStorePaidValues
    ? decimalOrNull(input.charge.paidAmount) ?? amount
    : null
  const netPaidAmount = shouldStorePaidValues ? decimalOrNull(input.charge.netAmount) : null
  const feeAmount = grossPaidAmount && netPaidAmount
    ? subtractMoney(grossPaidAmount, netPaidAmount)
    : null
  const providerPaymentDate = parseDate(input.charge.paymentDate)
  const providerCreditDate = parseDate(input.charge.creditDate)
  const cancelled = input.charge.status === 'cancelled'
  const refunded = input.charge.status === 'refunded'

  const externalCharge = await input.db.externalCharge.update({
    where: { id: saved.id },
    data: {
      status: input.charge.status,
      amount,
      dueDate: parseDate(input.charge.dueDate) || saved.dueDate,
      invoiceUrl: input.charge.invoiceUrl,
      bankSlipUrl: input.charge.bankSlipUrl,
      grossPaidAmount,
      netPaidAmount,
      feeAmount,
      providerPaymentDate,
      providerCreditDate,
      cancelledAt: cancelled ? (input.eventAt || new Date()) : saved.cancelledAt,
      lastEventAt: input.eventAt || saved.lastEventAt,
      lastSynchronizedAt: new Date(),
      providerPayload: input.providerPayload === undefined
        ? undefined
        : JSON.parse(JSON.stringify(input.providerPayload)) as Prisma.InputJsonValue,
    },
  })

  if (paidStatus(input.charge.status)) {
    const paidAmount = grossPaidAmount || amount
    const balance = subtractMoney(saved.receivable.amount, paidAmount)
    await input.db.receivable.update({
      where: { id: saved.receivableId },
      data: {
        status: balance.lte(0) ? 'paid' : 'pending',
        paidAmount,
        balance: balance.lte(0) ? 0 : balance,
        paidAt: providerPaymentDate || input.eventAt || new Date(),
      },
    })
  } else if ((cancelled || refunded) && saved.grossPaidAmount) {
    const anotherPaidCharge = saved.receivable.externalCharges.some(
      (charge) =>
        charge.id !== saved.id &&
        ['confirmed', 'received'].includes(charge.status),
    )
    if (!anotherPaidCharge) {
      await input.db.receivable.update({
        where: { id: saved.receivableId },
        data: {
          status: 'pending',
          paidAmount: 0,
          balance: saved.receivable.amount,
          paidAt: null,
        },
      })
    }
  }

  await createFinancialAuditLog(input.db, {
    companyId: saved.connection.companyId,
    actorId: input.actorId,
    action: `charge_${input.charge.status}`,
    entityType: 'external_charge',
    entityId: saved.id,
    saleId: saved.receivable.saleId,
    receivableId: saved.receivableId,
    externalChargeId: saved.id,
    metadata: {
      source: input.source,
      providerChargeId: saved.providerChargeId,
      previousStatus: saved.status,
      status: input.charge.status,
      grossPaidAmount: grossPaidAmount?.toString(),
      netPaidAmount: netPaidAmount?.toString(),
      feeAmount: feeAmount?.toString(),
    },
  })

  return { ignoredAsStale: false, externalCharge }
}
