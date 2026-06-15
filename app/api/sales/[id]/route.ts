import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, lotAccessWhere, reservationAccessWhere, saleAccessWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'
import { createLotEvent } from '@/lib/lot-events'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { calculateInstallment, evaluateDirectSaleTerms } from '@/lib/proposal-rules'
import { addMoney, decimal, moneyToNumber, multiplyMoney, subtractMoney } from '@/lib/money'

type Params = { params: Promise<{ id: string }> }

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function parseDateOnly(value?: string | null) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day, 12)
}

function toDateKey(value?: Date | null) {
  if (!value) return ''
  return value.toISOString().slice(0, 10)
}

function buildReceivables(
  saleId: string,
  data: { downPayment: number; installmentCount: number; installmentValue: number; firstDueDate?: Date | null },
) {
  const createdAt = new Date()
  const firstDueDate = data.firstDueDate ?? addMonths(createdAt, 1)
  const receivables: Array<{
    saleId: string
    kind: string
    sequence: number
    dueDate: Date
    amount: number
    balance: number
  }> = []

  if (data.downPayment > 0) {
    receivables.push({
      saleId,
      kind: 'down_payment',
      sequence: 0,
      dueDate: createdAt,
      amount: data.downPayment,
      balance: data.downPayment,
    })
  }

  for (let sequence = 1; sequence <= data.installmentCount; sequence += 1) {
    receivables.push({
      saleId,
      kind: 'installment',
      sequence,
      dueDate: addMonths(firstDueDate, sequence - 1),
      amount: data.installmentValue,
      balance: data.installmentValue,
    })
  }

  return receivables
}

export async function GET(_: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id

  const { id } = await params

  const sale = await prisma.sale.findFirst({
    where: {
      id,
      ...saleAccessWhere(currentUserId),
    },
    include: {
      user: true,
      lot: {
        include: {
          block: { include: { development: true } }
        }
      },
      reservation: true,
      receivables: {
        orderBy: [
          { dueDate: 'asc' },
          { sequence: 'asc' },
        ],
      },
    }
  })

  if (!sale) {
    return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
  }

  return NextResponse.json(sale)
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id

  const { id } = await params
  const data = await req.json()

  try {
    const existingSale = await prisma.sale.findFirst({
      where: {
        id,
        ...saleAccessWhere(currentUserId),
      },
      select: {
        id: true,
        userId: true,
        lotId: true,
        reservationId: true,
        proposalId: true,
        installmentCount: true,
        installmentValue: true,
        downPayment: true,
        firstDueDate: true,
        annualAdjustment: true,
        totalValue: true,
        contract: { select: { id: true } },
        receivables: {
          where: {
            OR: [
              { status: 'paid' },
              { paidAmount: { gt: 0 } },
            ],
          },
          select: { id: true },
          take: 1,
        },
      },
    })
    if (!existingSale) return forbiddenResponse()
    if (!data.correctionReason?.trim()) {
      return NextResponse.json({ error: 'Informe o motivo da correcao da venda.' }, { status: 400 })
    }
    if (existingSale.contract || existingSale.receivables.length > 0) {
      return NextResponse.json({ error: 'Esta venda possui contrato ou parcelas pagas e nao pode ser editada diretamente.' }, { status: 409 })
    }

    const lot = await prisma.lot.findFirst({
      where: {
        id: data.lotId,
        ...lotAccessWhere(currentUserId),
      },
      include: {
        block: {
          include: {
            development: {
              include: {
                settings: true,
              },
            },
          },
        },
      },
    })
    if (!lot?.block.developmentId) return forbiddenResponse()
    if (!(await hasDevelopmentPermission(currentUserId, lot.block.developmentId, 'admin'))) return forbiddenResponse()

    const buyerMembership = await prisma.developmentUser.findUnique({
      where: {
        developmentId_userId: {
          developmentId: lot.block.developmentId,
          userId: data.userId,
        },
      },
      select: { id: true },
    })
    if (!buyerMembership) return forbiddenResponse()

    if (data.reservationId) {
      const reservation = await prisma.reservation.findFirst({
        where: {
          id: data.reservationId,
          lotId: data.lotId,
          userId: data.userId,
          ...reservationAccessWhere(currentUserId),
        },
        select: { id: true },
      })
      if (!reservation) return forbiddenResponse()
    }

    const requestedDownPayment = Number(data.downPayment)
    const requestedInstallmentCount = Math.trunc(Number(data.installmentCount))
    const requestedFirstDueDate = parseDateOnly(data.firstDueDate)

    if (existingSale.proposalId) {
      const changesApprovedTerms = (
        data.userId !== existingSale.userId ||
        data.lotId !== existingSale.lotId ||
        (data.reservationId || null) !== existingSale.reservationId ||
        requestedDownPayment !== Number(existingSale.downPayment) ||
        requestedInstallmentCount !== existingSale.installmentCount ||
        Number(data.installmentValue) !== Number(existingSale.installmentValue) ||
        Number(data.totalValue) !== Number(existingSale.totalValue) ||
        toDateKey(requestedFirstDueDate) !== toDateKey(existingSale.firstDueDate) ||
        Boolean(data.annualAdjustment) !== existingSale.annualAdjustment
      )
      if (changesApprovedTerms) {
        return NextResponse.json(
          { error: 'Condicoes de uma proposta aprovada nao podem ser alteradas na venda. Crie uma nova proposta para revisar os valores.' },
          { status: 409 },
        )
      }
    }

    const settings = lot.block.development?.settings ?? {
      minDownPaymentPercentage: 10,
      maxInstallments: 120,
      defaultInterestRate: 0,
      interestCalculation: 'none',
      correctionIndex: 'none',
    }
    const directSaleEvaluation = evaluateDirectSaleTerms(settings, {
      basePrice: Number(lot.price),
      downPayment: requestedDownPayment,
      installmentCount: requestedInstallmentCount,
    })
    if (!existingSale.proposalId && !directSaleEvaluation.isValid) {
      return NextResponse.json(
        { error: `A venda nao atende as regras comerciais: ${directSaleEvaluation.reasons.join('; ')}.` },
        { status: 422 },
      )
    }

    const installmentCount = existingSale.proposalId ? existingSale.installmentCount : requestedInstallmentCount
    const downPayment = existingSale.proposalId ? Number(existingSale.downPayment) : requestedDownPayment
    const financedBalance = moneyToNumber(subtractMoney(lot.price, downPayment))
    const installmentValue = existingSale.proposalId
      ? Number(existingSale.installmentValue)
      : moneyToNumber(decimal(calculateInstallment(
          financedBalance,
          installmentCount,
          settings.defaultInterestRate,
          settings.interestCalculation,
        )))
    const totalValue = existingSale.proposalId
      ? Number(existingSale.totalValue)
      : moneyToNumber(addMoney(
          downPayment,
          multiplyMoney(installmentValue, installmentCount),
        ))
    const firstDueDate = existingSale.proposalId ? existingSale.firstDueDate : requestedFirstDueDate
    const annualAdjustment = existingSale.proposalId
      ? existingSale.annualAdjustment
      : settings.correctionIndex !== 'none'

    const updated = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.update({
        where: { id },
        data: {
          userId: data.userId,
          lotId: data.lotId,
          reservationId: data.reservationId || null,
          installmentCount,
          installmentValue,
          downPayment,
          firstDueDate,
          annualAdjustment,
          totalValue,
          updatedAt: new Date(),
        },
        include: {
          user: true,
          lot: {
            include: {
              block: true
            }
          },
          reservation: true,
          receivables: {
            orderBy: [
              { dueDate: 'asc' },
              { sequence: 'asc' },
            ],
          },
        }
      })

      await tx.receivable.deleteMany({ where: { saleId: sale.id } })
      const receivables = buildReceivables(sale.id, {
        downPayment: Number(sale.downPayment),
        installmentCount: sale.installmentCount,
        installmentValue: Number(sale.installmentValue),
        firstDueDate: sale.firstDueDate,
      })
      if (receivables.length > 0) {
        await tx.receivable.createMany({ data: receivables })
      }

      await createLotEvent(tx, {
        lotId: sale.lotId,
        userId: currentUserId,
        type: 'sale_corrected',
        title: 'Venda corrigida',
        description: `Venda corrigida para ${sale.user.name}.`,
        notes: data.correctionReason.trim(),
      })

      return sale
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error updating sale:', error)
    return NextResponse.json({ error: 'Failed to update sale.' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id

  const { id } = await params

  try {
    const canAccessSale = await prisma.sale.findFirst({
      where: {
        id,
        ...saleAccessWhere(currentUserId),
      },
      select: { id: true },
    })
    if (!canAccessSale) return forbiddenResponse()

    // Start a transaction to ensure data consistency
    await prisma.$transaction(async (prisma) => {
      // Get the sale to find the lot ID
      const sale = await prisma.sale.findUnique({
        where: { id },
        select: { lotId: true }
      })

      if (!sale) {
        throw new Error('Sale not found')
      }

      // Delete the sale
      await prisma.sale.delete({
        where: { id }
      })

      // Update lot status back to available
      await prisma.lot.update({
        where: { id: sale.lotId },
        data: { status: 'available' }
      })
    })

    return NextResponse.json({ deleted: true })
  } catch (error: any) {
    console.error('Error deleting sale:', error)
    return NextResponse.json({ error: 'Failed to delete sale.' }, { status: 500 })
  }
}
