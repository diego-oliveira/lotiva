import { createHash } from 'crypto'
import type { Prisma } from '@/app/generated/prisma'
import { calculateSettlement, monthPeriod, type SettlementExpense, type SettlementAdjustment, type SettlementSnapshot, type DistributionParticipant } from './partner-settlements'

type Draft = { month: string; participants: unknown; expenses: unknown; adjustments: unknown }

export function snapshotToken(snapshot: SettlementSnapshot) {
  // PostgreSQL JSONB may reorder object keys when a snapshot is read back.
  const canonical = (value: unknown): unknown => Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonical(item)]))
      : value
  return createHash('sha256').update(JSON.stringify(canonical(snapshot))).digest('hex')
}

export async function buildSettlementSnapshot(db: Prisma.TransactionClient, developmentId: string, developmentName: string, draft: Draft) {
  const { start, end } = monthPeriod(draft.month)
  const [receipts, commissions] = await Promise.all([
    db.receivable.findMany({
      where: { sale: { lot: { block: { developmentId } } }, paidAmount: { gt: 0 }, paidAt: { gte: start, lt: end } },
      select: { id: true, saleId: true, kind: true, sequence: true, paidAmount: true, paidAt: true, sale: { select: { user: { select: { name: true } }, lot: { select: { identifier: true, block: { select: { identifier: true } } } } } } },
      orderBy: { id: 'asc' },
    }),
    db.commissionPayment.findMany({
      where: { commission: { sale: { lot: { block: { developmentId } } } }, paidAt: { gte: start, lt: end } },
      select: { id: true, amount: true, paidAt: true, commission: { select: { saleId: true, user: { select: { name: true } }, sale: { select: { lot: { select: { identifier: true, block: { select: { identifier: true } } } } } } } } },
      orderBy: { id: 'asc' },
    }),
  ])
  return calculateSettlement({
    developmentName, month: draft.month, participants: draft.participants as DistributionParticipant[],
    expenses: draft.expenses as SettlementExpense[], adjustments: draft.adjustments as SettlementAdjustment[],
    receipts: receipts.map((receipt) => ({
      id: receipt.id, saleId: receipt.saleId, amount: Number(receipt.paidAmount), paidAt: receipt.paidAt!.toISOString(),
      description: `${receipt.sale.user.name} · Q${receipt.sale.lot.block.identifier} / L${receipt.sale.lot.identifier} · ${receipt.kind === 'down_payment' ? 'Entrada' : `Parcela ${receipt.sequence}`}`,
    })),
    commissions: commissions.map((payment) => ({
      id: payment.id, saleId: payment.commission.saleId, amount: Number(payment.amount), paidAt: payment.paidAt.toISOString(),
      description: `${payment.commission.user.name} · Q${payment.commission.sale.lot.block.identifier} / L${payment.commission.sale.lot.identifier}`,
    })),
  })
}
