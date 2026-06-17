import { Prisma, type PrismaClient } from '@/app/generated/prisma'
import { prisma } from '@/lib/prisma'
import { decimal } from '@/lib/money'
import { createFinancialAuditLog } from './audit'

type PaymentDatabase = PrismaClient | Prisma.TransactionClient

export async function createAdjustmentReview(input: {
  connectionId: string
  saleId: string
  indexName: string
  percentage: string | number
  source: string
  reason: string
  createdById: string
  db?: PaymentDatabase
}) {
  const db = input.db ?? prisma
  const percentage = new Prisma.Decimal(input.percentage)
  if (percentage.lte(0) || percentage.gt(100)) {
    throw new Error('O percentual de reajuste deve ser maior que zero e menor ou igual a 100%.')
  }
  if (!input.indexName.trim() || !input.source.trim() || !input.reason.trim()) {
    throw new Error('Informe indice, fonte e justificativa do reajuste.')
  }

  const sale = await db.sale.findUnique({
    where: { id: input.saleId },
    include: {
      lot: { include: { block: { include: { development: true } } } },
      billingCycles: {
        where: { connectionId: input.connectionId, status: 'issued' },
        orderBy: { cycleNumber: 'desc' },
        take: 1,
      },
      receivables: {
        where: { kind: 'installment', status: { not: 'paid' } },
        orderBy: { sequence: 'asc' },
        include: {
          externalCharges: { where: { connectionId: input.connectionId } },
        },
      },
    },
  })
  const connection = await db.paymentProviderConnection.findUnique({
    where: { id: input.connectionId },
  })
  if (!sale || !connection || sale.lot.block.development?.companyId !== connection.companyId) {
    throw new Error('Venda e conexao financeira nao pertencem a mesma empresa.')
  }
  const previousCycle = sale.billingCycles[0]
  if (!previousCycle) {
    throw new Error('O primeiro ciclo deve ser emitido antes de criar um reajuste anual.')
  }

  const cycleNumber = previousCycle.cycleNumber + 1
  const eligible = sale.receivables
    .filter((receivable) =>
      receivable.sequence > previousCycle.endSequence &&
      receivable.externalCharges.length === 0,
    )
  if (eligible.length === 0) {
    throw new Error('Nao existem parcelas futuras elegiveis para reajuste.')
  }

  const existingReview = await db.adjustmentReview.findUnique({
    where: {
      connectionId_saleId_cycleNumber: {
        connectionId: input.connectionId,
        saleId: input.saleId,
        cycleNumber,
      },
    },
    select: { id: true, status: true },
  })

  if (existingReview?.status === 'applied') {
    throw new Error('Este ciclo ja possui um reajuste aprovado. Emita o proximo ciclo para criar um novo reajuste.')
  }

  const items = eligible.map((receivable) => ({
    receivableId: receivable.id,
    previousAmount: receivable.amount,
    adjustedAmount: decimal(receivable.amount)
      .times(new Prisma.Decimal(1).plus(percentage.dividedBy(100)))
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
  }))

  const reviewData = {
    indexName: input.indexName.trim(),
    percentage,
    source: input.source.trim(),
    reason: input.reason.trim(),
    createdById: input.createdById,
    status: 'pending',
    reviewedById: null,
    reviewedAt: null,
    appliedAt: null,
    rejectionReason: null,
  }

  if (existingReview) {
    await db.adjustmentReviewItem.deleteMany({
      where: { adjustmentReviewId: existingReview.id },
    })
  }

  const includeItems = {
    items: {
      include: {
        receivable: { select: { sequence: true, dueDate: true } },
      },
      orderBy: { receivable: { sequence: 'asc' } },
    },
  } satisfies Prisma.AdjustmentReviewInclude

  const review = existingReview
    ? await db.adjustmentReview.update({
      where: { id: existingReview.id },
      data: {
        ...reviewData,
        items: { create: items },
      },
      include: includeItems,
    })
    : await db.adjustmentReview.create({
      data: {
        connectionId: input.connectionId,
        saleId: input.saleId,
        cycleNumber,
        ...reviewData,
        items: { create: items },
      },
      include: includeItems,
    })

  const auditAction = existingReview
    ? existingReview.status === 'rejected'
      ? 'adjustment_review_reopened'
      : 'adjustment_review_updated'
    : 'adjustment_review_created'

  await createFinancialAuditLog(db, {
    companyId: connection.companyId,
    actorId: input.createdById,
    action: auditAction,
    entityType: 'adjustment_review',
    entityId: review.id,
    saleId: sale.id,
    metadata: {
      cycleNumber,
      indexName: review.indexName,
      percentage: review.percentage.toString(),
      affectedReceivables: review.items.length,
    },
  })
  return review
}

export async function reviewAdjustment(input: {
  reviewId: string
  reviewerId: string
  action: 'approve' | 'reject'
  rejectionReason?: string
  db?: PrismaClient
}) {
  const db = input.db ?? prisma
  const review = await db.adjustmentReview.findUnique({
    where: { id: input.reviewId },
    include: {
      connection: true,
      items: {
        include: {
          receivable: {
            include: {
              externalCharges: true,
            },
          },
        },
      },
    },
  })
  if (!review || review.status !== 'pending') {
    throw new Error('Revisao de reajuste nao encontrada ou ja analisada.')
  }

  if (input.action === 'reject') {
    if (!input.rejectionReason?.trim()) throw new Error('Informe o motivo da rejeicao.')
    const rejected = await db.adjustmentReview.update({
      where: { id: review.id },
      data: {
        status: 'rejected',
        reviewedById: input.reviewerId,
        reviewedAt: new Date(),
        rejectionReason: input.rejectionReason.trim(),
      },
    })
    await createFinancialAuditLog(db, {
      companyId: review.connection.companyId,
      actorId: input.reviewerId,
      action: 'adjustment_review_rejected',
      entityType: 'adjustment_review',
      entityId: review.id,
      saleId: review.saleId,
      metadata: { reason: input.rejectionReason.trim() },
    })
    return rejected
  }

  return db.$transaction(async (tx) => {
    for (const item of review.items) {
      const activeCharge = item.receivable.externalCharges.some(
        (charge) =>
          charge.connectionId === review.connectionId &&
          !['cancelled', 'refunded'].includes(charge.status),
      )
      if (item.receivable.status === 'paid' || activeCharge) {
        throw new Error(`A parcela ${item.receivable.sequence} nao pode mais ser reajustada.`)
      }
      await tx.receivable.update({
        where: { id: item.receivableId },
        data: {
          amount: item.adjustedAmount,
          balance: item.adjustedAmount,
        },
      })
    }

    const applied = await tx.adjustmentReview.update({
      where: { id: review.id },
      data: {
        status: 'applied',
        reviewedById: input.reviewerId,
        reviewedAt: new Date(),
        appliedAt: new Date(),
      },
      include: { items: true },
    })
    await createFinancialAuditLog(tx, {
      companyId: review.connection.companyId,
      actorId: input.reviewerId,
      action: 'adjustment_review_applied',
      entityType: 'adjustment_review',
      entityId: review.id,
      saleId: review.saleId,
      metadata: {
        cycleNumber: review.cycleNumber,
        percentage: review.percentage.toString(),
        affectedReceivables: review.items.length,
      },
    })
    return applied
  })
}
