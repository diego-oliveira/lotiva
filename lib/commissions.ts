import { Prisma, PrismaClient } from '@/app/generated/prisma'

type DbClient = PrismaClient | Prisma.TransactionClient

export type CommissionReleaseContext = { entryPaidRatio: number }

export async function getCommissionReleaseContext(db: DbClient, saleId: string): Promise<CommissionReleaseContext> {
  const sale = await db.sale.findUnique({
    where: { id: saleId },
    select: {
      downPayment: true,
      receivables: { where: { kind: 'down_payment' }, select: { amount: true, paidAmount: true, balance: true, status: true } },
    },
  })
  if (!sale) return { entryPaidRatio: 0 }
  const downPayment = Number(sale.downPayment)
  if (downPayment <= 0 || sale.receivables.length === 0) return { entryPaidRatio: 1 }
  const paidEntry = sale.receivables.reduce((sum, item) => {
    const amount = Number(item.amount)
    const paid = item.status === 'paid' ? amount : Math.max(Number(item.paidAmount), amount - Number(item.balance))
    return sum + Math.min(amount, Math.max(0, paid))
  }, 0)
  return { entryPaidRatio: Math.min(1, paidEntry / downPayment) }
}

export function calculateCommissionAvailability(amount: number, paid: number, context: CommissionReleaseContext) {
  const releasedAmount = Math.min(amount, Math.round(amount * context.entryPaidRatio * 100) / 100)
  return {
    releasedAmount,
    availableAmount: Math.max(0, Math.round((releasedAmount - paid) * 100) / 100),
  }
}

export async function syncSaleCommissions(db: DbClient, saleId: string) {
  const sale = await db.sale.findUnique({
    where: { id: saleId },
    select: {
      commissions: { include: { payments: { select: { amount: true } } } },
    },
  })
  if (!sale) return

  const context = await getCommissionReleaseContext(db, saleId)

  await Promise.all(sale.commissions.map(async (commission) => {
    const paid = commission.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    const amount = Number(commission.amount)
    const { releasedAmount } = calculateCommissionAvailability(amount, paid, context)
    const status = paid >= amount - 0.005
      ? 'paid'
      : paid > 0
        ? 'partially_paid'
        : context.entryPaidRatio >= 1
          ? 'released'
          : releasedAmount > 0
            ? 'partially_released'
            : 'waiting_entry'
    await db.saleCommission.update({
      where: { id: commission.id },
      data: {
        status,
        releasedAt: releasedAmount > 0 ? commission.releasedAt ?? new Date() : null,
      },
    })
  }))
}

export function commissionAmount(salePrice: number, percentage: number) {
  return Math.round(salePrice * percentage) / 100
}
