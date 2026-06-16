import { prisma } from '@/lib/prisma'

const financeRoleNames = new Set([
  'owner',
  'administrador',
  'admin',
  'gestor',
  'manager',
  'financeiro',
  'finance',
])

function differenceInDays(date: Date, now: Date) {
  const day = 86_400_000
  return Math.ceil((date.getTime() - now.getTime()) / day)
}

export async function createAdjustmentCycleAlerts(now = new Date()) {
  const cycles = await prisma.billingCycle.findMany({
    where: { status: 'issued' },
    include: {
      connection: true,
      externalCharges: { orderBy: { dueDate: 'desc' }, take: 1 },
      sale: {
        include: {
          receivables: {
            where: { kind: 'installment', status: { not: 'paid' } },
            select: { sequence: true },
          },
          adjustmentReviews: true,
          lot: {
            include: {
              block: {
                include: {
                  development: {
                    include: {
                      memberships: {
                        include: {
                          roles: { include: { role: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { cycleNumber: 'desc' },
  })

  let created = 0
  const latestByConnectionAndSale = new Set<string>()
  for (const cycle of cycles) {
    const key = `${cycle.connectionId}:${cycle.saleId}`
    if (latestByConnectionAndSale.has(key)) continue
    latestByConnectionAndSale.add(key)

    const lastDueDate = cycle.externalCharges[0]?.dueDate
    if (!lastDueDate || !cycle.sale.annualAdjustment) continue
    if (!cycle.sale.receivables.some((receivable) => receivable.sequence > cycle.endSequence)) continue
    const nextCycleNumber = cycle.cycleNumber + 1
    if (cycle.sale.adjustmentReviews.some(
      (review) =>
        review.connectionId === cycle.connectionId &&
        review.cycleNumber === nextCycleNumber &&
        ['pending', 'applied'].includes(review.status),
    )) continue

    const days = differenceInDays(lastDueDate, now)
    if (![60, 30, 15].includes(days)) continue
    const development = cycle.sale.lot.block.development
    if (!development) continue

    for (const membership of development.memberships) {
      const canReceive = membership.roles.some((assignment) =>
        financeRoleNames.has(assignment.role.name.trim().toLowerCase()),
      )
      if (!canReceive) continue
      const result = await prisma.notification.createMany({
        data: [{
          userId: membership.userId,
          type: 'billing_cycle_adjustment_due',
          title: `Reajuste anual em ${days} dias`,
          message: `A venda precisa de revisao do reajuste antes do ciclo ${nextCycleNumber}.`,
          href: `/sales?adjustmentSaleId=${cycle.saleId}`,
          deduplicationKey: `adjustment:${cycle.connectionId}:${cycle.saleId}:${nextCycleNumber}:${days}:${membership.userId}`,
        }],
        skipDuplicates: true,
      })
      created += result.count
    }
  }
  return { created }
}
