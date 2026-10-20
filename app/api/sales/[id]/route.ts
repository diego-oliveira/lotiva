import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, lotAccessWhere, reservationAccessWhere, saleAccessWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'
import { createLotEvent } from '@/lib/lot-events'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { calculateInstallment } from '@/lib/proposal-rules'
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

function resolveFirstInstallmentDueDate(requestedDate: Date, downPaymentFirstDueDate: Date, downPayment: number, downPaymentInstallmentCount: number) {
  if (downPayment <= 0) return requestedDate
  const firstDateAfterDownPayment = addMonths(downPaymentFirstDueDate, downPaymentInstallmentCount)
  return requestedDate < firstDateAfterDownPayment ? firstDateAfterDownPayment : requestedDate
}

function buildReceivables(
  saleId: string,
  data: { downPayment: number; downPaymentInstallmentCount: number; downPaymentFirstDueDate?: Date | null; installmentCount: number; installmentValue: number; firstDueDate?: Date | null; saleDate?: Date },
) {
  const createdAt = data.saleDate ?? new Date()
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
    const count = Math.max(1, data.downPaymentInstallmentCount)
    const downPaymentFirstDueDate = data.downPaymentFirstDueDate ?? createdAt
    const regularAmount = Math.floor((data.downPayment * 100) / count) / 100
    for (let position = 1; position <= count; position += 1) {
      const amount = position === count ? Math.round((data.downPayment - regularAmount * (count - 1)) * 100) / 100 : regularAmount
      receivables.push({ saleId, kind: 'down_payment', sequence: count === 1 ? 0 : position, dueDate: addMonths(downPaymentFirstDueDate, position - 1), amount, balance: amount })
    }
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
        createdAt: true,
        userId: true,
        lotId: true,
        reservationId: true,
        proposalId: true,
        salePrice: true,
        installmentCount: true,
        installmentValue: true,
        downPayment: true,
        downPaymentInstallmentCount: true,
        downPaymentFirstDueDate: true,
        firstDueDate: true,
        annualAdjustment: true,
        totalValue: true,
        proposal: {
          select: {
            interestRate: true,
            interestCalculation: true,
          },
        },
        contract: { select: { id: true } },
        participants: { select: { id: true, userId: true, relationshipType: true } },
        receivables: {
          select: {
            id: true,
            kind: true,
            sequence: true,
            dueDate: true,
            amount: true,
            status: true,
            paidAmount: true,
            externalCharges: {
              select: { id: true, status: true },
            },
          },
        },
      },
    })
    if (!existingSale) return forbiddenResponse()
    if (!data.correctionReason?.trim()) {
      return NextResponse.json({ error: 'Informe o motivo da correcao da venda.' }, { status: 400 })
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

    if (data.coBuyerId) {
      if (data.coBuyerId === data.userId) return NextResponse.json({ error: 'A pessoa adicional deve ser diferente do comprador principal.' }, { status: 400 })
      const participant = await prisma.user.findFirst({ where: { id: data.coBuyerId, OR: [{ memberships: { some: { developmentId: lot.block.developmentId } } }, { companyMemberships: { some: { companyId: lot.block.development!.companyId } } }] } })
      if (!participant) return NextResponse.json({ error: 'Selecione uma pessoa adicional valida.' }, { status: 400 })
      const missing = (['cpf', 'rg', 'address', 'birthDate', 'profession', 'birthplace', 'maritalStatus'] as const).filter((field) => !participant[field])
      if (missing.length) return NextResponse.json({ error: 'A pessoa adicional nao tem todos os dados legais preenchidos.' }, { status: 400 })
    }

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
    const requestedSalePrice = Number(data.salePrice)
    const requestedInstallmentCount = Math.trunc(Number(data.installmentCount))
    const requestedDownPaymentInstallmentCount = data.downPaymentInstallmentCount == null ? 1 : Math.trunc(Number(data.downPaymentInstallmentCount))
    if (!Number.isFinite(requestedSalePrice) || requestedSalePrice <= 0) {
      return NextResponse.json({ error: 'Informe um valor de venda valido.' }, { status: 400 })
    }
    if (!Number.isFinite(requestedDownPayment) || requestedDownPayment < 0 || requestedDownPayment > requestedSalePrice) {
      return NextResponse.json({ error: 'A entrada deve estar entre zero e o valor da venda.' }, { status: 400 })
    }
    if (!Number.isFinite(requestedInstallmentCount) || requestedInstallmentCount < 1) {
      return NextResponse.json({ error: 'Informe uma quantidade de parcelas valida.' }, { status: 400 })
    }
    const requestedFirstDueDate = parseDateOnly(data.firstDueDate)
    const requestedDownPaymentFirstDueDate = parseDateOnly(data.downPaymentFirstDueDate) ?? existingSale.downPaymentFirstDueDate ?? existingSale.createdAt
    if (!requestedFirstDueDate) {
      return NextResponse.json({ error: 'Informe o primeiro vencimento.' }, { status: 400 })
    }

    const changesSaleTerms = (
      data.userId !== existingSale.userId ||
      data.lotId !== existingSale.lotId ||
      (data.reservationId || null) !== existingSale.reservationId ||
      requestedSalePrice !== Number(existingSale.salePrice) ||
      requestedDownPayment !== Number(existingSale.downPayment) ||
      requestedDownPaymentInstallmentCount !== existingSale.downPaymentInstallmentCount ||
      toDateKey(requestedDownPaymentFirstDueDate) !== toDateKey(existingSale.downPaymentFirstDueDate) ||
      requestedInstallmentCount !== existingSale.installmentCount ||
      Number(data.installmentValue) !== Number(existingSale.installmentValue) ||
      Number(data.totalValue) !== Number(existingSale.totalValue) ||
      Boolean(data.annualAdjustment) !== existingSale.annualAdjustment
    )
    const normalizedFirstDueDate = resolveFirstInstallmentDueDate(
      requestedFirstDueDate,
      requestedDownPaymentFirstDueDate,
      requestedDownPayment,
      requestedDownPaymentInstallmentCount,
    )
    const dueDateChanged = toDateKey(normalizedFirstDueDate) !== toDateKey(existingSale.firstDueDate)
    const hasActiveExternalCharges = existingSale.receivables.some(
      (receivable) => receivable.externalCharges.some(
        (charge) => !['confirmed', 'received', 'cancelled', 'refunded'].includes(charge.status),
      ),
    )
    if (changesSaleTerms && hasActiveExternalCharges) {
      return NextResponse.json(
        { error: 'Cancele os boletos ativos antes de alterar valores ou a quantidade de parcelas.' },
        { status: 409 },
      )
    }
    const pendingInstallmentHasActiveCharge = existingSale.receivables.some(
      (receivable) => receivable.kind === 'installment' &&
        receivable.status !== 'paid' &&
        Number(receivable.paidAmount) <= 0 &&
        receivable.externalCharges.some(
          (charge) => !['confirmed', 'received', 'cancelled', 'refunded'].includes(charge.status),
        ),
    )
    if (dueDateChanged && pendingInstallmentHasActiveCharge) {
      return NextResponse.json(
        { error: 'Cancele os boletos ativos das parcelas pendentes antes de alterar o calendario de vencimentos.' },
        { status: 409 },
      )
    }

    const settings = lot.block.development?.settings ?? {
      minDownPaymentPercentage: 10,
      maxInstallments: 120,
      defaultInterestRate: 0,
      interestCalculation: 'none',
      correctionIndex: 'none',
      allowDownPaymentInstallments: false,
      maxDownPaymentInstallments: 1,
    }
    if (!Number.isFinite(requestedDownPaymentInstallmentCount) || requestedDownPaymentInstallmentCount < 1 || (!settings.allowDownPaymentInstallments && requestedDownPaymentInstallmentCount !== 1) || requestedDownPaymentInstallmentCount > settings.maxDownPaymentInstallments) {
      return NextResponse.json({ error: 'O parcelamento da entrada nao atende as regras do empreendimento.' }, { status: 422 })
    }
    if (requestedDownPaymentInstallmentCount !== existingSale.downPaymentInstallmentCount && existingSale.receivables.some((item) => item.kind === 'down_payment' && (item.status === 'paid' || Number(item.paidAmount) > 0))) {
      return NextResponse.json({ error: 'Nao e possivel alterar o parcelamento de uma entrada que ja possui pagamento.' }, { status: 409 })
    }
    const installmentCount = requestedInstallmentCount
    const downPayment = requestedDownPayment
    const financedBalance = moneyToNumber(subtractMoney(requestedSalePrice, downPayment))
    const interestRate = existingSale.proposal?.interestRate ?? settings.defaultInterestRate
    const interestCalculation = existingSale.proposal?.interestCalculation ?? settings.interestCalculation
    const installmentValue = moneyToNumber(decimal(calculateInstallment(
      financedBalance,
      installmentCount,
      interestRate,
      interestCalculation,
    )))
    const totalValue = moneyToNumber(addMoney(
      downPayment,
      multiplyMoney(installmentValue, installmentCount),
    ))
    const firstDueDate = normalizedFirstDueDate
    const annualAdjustment = Boolean(data.annualAdjustment)
    const participantUserId = data.coBuyerId || null
    const relationshipType = ['spouse', 'partner', 'independent'].includes(data.relationshipType) ? data.relationshipType : 'independent'

    const updated = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.update({
        where: { id },
        data: {
          userId: data.userId,
          lotId: data.lotId,
          reservationId: data.reservationId || null,
          salePrice: requestedSalePrice,
          installmentCount,
          installmentValue,
          downPayment,
          downPaymentInstallmentCount: requestedDownPaymentInstallmentCount,
          downPaymentFirstDueDate: requestedDownPaymentFirstDueDate,
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

      await tx.saleParticipant.deleteMany({ where: { saleId: id } })
      if (participantUserId) {
        await tx.saleParticipant.create({ data: { saleId: id, userId: participantUserId, role: 'buyer', relationshipType } })
        const [personAId, personBId] = [data.userId, participantUserId].sort()
        await tx.userRelationship.deleteMany({ where: { personAId, personBId, type: { in: ['spouse', 'partner'] } } })
        if (relationshipType !== 'independent') await tx.userRelationship.create({ data: { personAId, personBId, type: relationshipType } })
      }

      const onlyDueDateChanged = !changesSaleTerms
      if (onlyDueDateChanged) {
        const pendingInstallments = existingSale.receivables.filter(
          (receivable) => receivable.kind === 'installment' && receivable.status !== 'paid' && Number(receivable.paidAmount) <= 0,
        )
        await Promise.all(pendingInstallments.map((receivable) => tx.receivable.update({
          where: { id: receivable.id },
          data: { dueDate: addMonths(firstDueDate, receivable.sequence - 1) },
        })))
      } else {
        const desiredReceivables = buildReceivables(sale.id, {
          downPayment: Number(sale.downPayment),
          downPaymentInstallmentCount: sale.downPaymentInstallmentCount,
          downPaymentFirstDueDate: sale.downPaymentFirstDueDate,
          installmentCount: sale.installmentCount,
          installmentValue: Number(sale.installmentValue),
          firstDueDate: sale.firstDueDate,
          saleDate: existingSale.createdAt,
        })
        const desiredByKey = new Map(desiredReceivables.map(
          (receivable) => [`${receivable.kind}:${receivable.sequence}`, receivable],
        ))
        const existingByKey = new Map(existingSale.receivables.map(
          (receivable) => [`${receivable.kind}:${receivable.sequence}`, receivable],
        ))

        await Promise.all(existingSale.receivables.map(async (receivable) => {
          const desired = desiredByKey.get(`${receivable.kind}:${receivable.sequence}`)
          if (!desired) {
            if (Number(receivable.paidAmount) > 0 || receivable.status === 'paid') {
              return tx.receivable.update({
                where: { id: receivable.id },
                data: { balance: 0, status: 'paid' },
              })
            }
            return tx.receivable.delete({ where: { id: receivable.id } })
          }

          const paidAmount = Number(receivable.paidAmount)
          const balance = Math.max(desired.amount - paidAmount, 0)
          return tx.receivable.update({
            where: { id: receivable.id },
            data: {
              dueDate: desired.dueDate,
              amount: desired.amount,
              balance,
              status: paidAmount >= desired.amount && paidAmount > 0 ? 'paid' : 'pending',
            },
          })
        }))

        const newReceivables = desiredReceivables.filter(
          (receivable) => !existingByKey.has(`${receivable.kind}:${receivable.sequence}`),
        )
        if (newReceivables.length > 0) {
          await tx.receivable.createMany({ data: newReceivables })
        }
      }

      if (data.lotId !== existingSale.lotId) {
        await tx.lot.update({ where: { id: existingSale.lotId }, data: { status: 'available' } })
        await tx.lot.update({ where: { id: data.lotId }, data: { status: 'sold' } })
      }

      if (changesSaleTerms && existingSale.contract) {
        await tx.contract.update({
          where: { id: existingSale.contract.id },
          data: { status: 'outdated' },
        })
      }

      await createLotEvent(tx, {
        lotId: sale.lotId,
        userId: currentUserId,
        type: 'sale_corrected',
        title: 'Venda corrigida',
        description: changesSaleTerms
          ? `Venda corrigida para ${sale.user.name}: valor de ${Number(existingSale.salePrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para ${Number(sale.salePrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`
          : `Venda corrigida para ${sale.user.name}.`,
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
