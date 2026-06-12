// app/api/sales/route.ts
import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, lotAccessWhere, proposalAccessWhere, reservationAccessWhere, saleAccessWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'
import { generateContractNumber, generateContractHTML } from '@/lib/contractGenerator'
import { createLotEvent } from '@/lib/lot-events'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { calculateInstallment, evaluateDirectSaleTerms } from '@/lib/proposal-rules'

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
    const amount = data.installmentValue
    receivables.push({
      saleId,
      kind: 'installment',
      sequence,
      dueDate: addMonths(firstDueDate, sequence - 1),
      amount,
      balance: amount,
    })
  }

  return receivables
}

export async function GET() {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id

  const sales = await prisma.sale.findMany({
    where: saleAccessWhere(currentUserId),
    include: { 
      user: true, 
      lot: {
        include: {
          block: { include: { development: true } }
        }
      },
      reservation: true,
      contract: true,
      receivables: {
        orderBy: [
          { dueDate: 'asc' },
          { sequence: 'asc' },
        ],
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(sales)
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id

  const data = await req.json()

  try {
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
        sale: true,
        reservations: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })
    if (!lot?.block.developmentId) return forbiddenResponse()
    if (!(await hasDevelopmentPermission(currentUserId, lot.block.developmentId, 'sales'))) return forbiddenResponse()
    if (lot.sale || lot.status === 'sold') {
      return NextResponse.json({ error: 'Este lote ja foi vendido.' }, { status: 400 })
    }

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

    const latestProposal = await prisma.proposal.findFirst({
      where: {
        lotId: data.lotId,
        userId: data.userId,
      },
      orderBy: { createdAt: 'desc' },
    })
    const approvedProposal = await prisma.proposal.findFirst({
      where: {
        id: data.proposalId || latestProposal?.id || '',
        lotId: data.lotId,
        userId: data.userId,
        status: 'approved',
        ...proposalAccessWhere(currentUserId),
      },
    })
    if (data.proposalId && !approvedProposal) {
      return NextResponse.json({ error: 'A proposta selecionada nao esta aprovada para venda.' }, { status: 409 })
    }
    if (latestProposal && latestProposal.id !== approvedProposal?.id) {
      return NextResponse.json(
        { error: 'A proposta mais recente precisa ser aprovada antes de continuar com a venda.' },
        { status: 409 },
      )
    }

    const settings = lot.block.development?.settings ?? {
      minDownPaymentPercentage: 10,
      maxInstallments: 120,
      defaultInterestRate: 0,
      interestCalculation: 'none',
      correctionIndex: 'none',
    }
    const requestedDownPayment = Number(data.downPayment)
    const requestedInstallmentCount = Math.trunc(Number(data.installmentCount))
    const directSaleEvaluation = evaluateDirectSaleTerms(settings, {
      basePrice: lot.price,
      downPayment: requestedDownPayment,
      installmentCount: requestedInstallmentCount,
    })
    if (!approvedProposal && !directSaleEvaluation.isValid) {
      return NextResponse.json(
        {
          error: `A venda direta nao atende as regras comerciais: ${directSaleEvaluation.reasons.join('; ')}. Crie uma proposta para solicitar uma excecao.`,
        },
        { status: 422 },
      )
    }

    const activeReservation = lot.reservations.find((reservation) => !reservation.cancelledAt && reservation.status !== 'cancelled')
    if (activeReservation && activeReservation.userId !== data.userId) {
      return NextResponse.json({ error: 'Este lote esta reservado para outro cliente.' }, { status: 409 })
    }

    const reservationId = data.reservationId || activeReservation?.id || null
    if (reservationId) {
      const reservation = await prisma.reservation.findFirst({
        where: {
          id: reservationId,
          lotId: data.lotId,
          userId: data.userId,
          ...reservationAccessWhere(currentUserId),
        },
        select: { id: true },
      })
      if (!reservation) return forbiddenResponse()
    }

    // Validate user has all fields required for contract generation
    const user = await prisma.user.findUnique({ where: { id: data.userId } })
    if (!user) {
      return NextResponse.json({ error: 'Usuario nao encontrado.' }, { status: 400 })
    }
    const missing = (['cpf', 'rg', 'address', 'birthDate', 'profession', 'birthplace', 'maritalStatus'] as const)
      .filter((f) => !user[f])
    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'O usuario nao tem todos os dados legais preenchidos. Complete o cadastro antes de criar uma venda.', missingFields: missing },
        { status: 400 },
      )
    }

    // Start a transaction to ensure data consistency
    const firstDueDate = approvedProposal?.firstDueDate ?? parseDateOnly(data.firstDueDate) ?? addMonths(new Date(), 1)
    const downPayment = approvedProposal?.downPayment ?? requestedDownPayment
    const installmentCount = approvedProposal?.installmentCount ?? requestedInstallmentCount
    const financedBalance = Math.max(lot.price - downPayment, 0)
    const calculatedInstallmentValue = calculateInstallment(
      financedBalance,
      installmentCount,
      settings.defaultInterestRate,
      settings.interestCalculation,
    )
    const installmentValue = approvedProposal?.installmentValue ?? Math.round(calculatedInstallmentValue * 100) / 100
    const totalValue = approvedProposal?.totalValue ?? downPayment + installmentValue * installmentCount
    const annualAdjustment = approvedProposal
      ? approvedProposal.correctionIndex !== 'none'
      : settings.correctionIndex !== 'none'

    const result = await prisma.$transaction(async (prisma) => {
      // Create the sale
      const sale = await prisma.sale.create({
        data: {
          userId: data.userId,
          lotId: data.lotId,
          reservationId,
          proposalId: approvedProposal?.id ?? null,
          installmentCount,
          installmentValue,
          downPayment,
          firstDueDate,
          annualAdjustment,
          totalValue,
        },
        include: {
          user: true,
          lot: {
            include: {
              block: true
            }
          },
          reservation: true
        }
      })

      const receivables = buildReceivables(sale.id, {
        downPayment: sale.downPayment,
        installmentCount: sale.installmentCount,
        installmentValue: sale.installmentValue,
        firstDueDate,
      })

      if (receivables.length > 0) {
        await prisma.receivable.createMany({ data: receivables })
      }

      // Update lot status to sold
      await prisma.lot.update({
        where: { id: data.lotId },
        data: { status: 'sold' }
      })

      if (reservationId) {
        await prisma.reservation.update({
          where: { id: reservationId },
          data: { status: 'converted' },
        })
      }

      if (approvedProposal) {
        await prisma.proposal.update({
          where: { id: approvedProposal.id },
          data: { status: 'converted' },
        })
      }

      await createLotEvent(prisma, {
        lotId: data.lotId,
        userId: currentUserId,
        type: 'sale_created',
        title: 'Venda registrada',
        description: `Venda para ${sale.user.name} no valor de ${sale.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
      })

      // Auto-generate contract
      try {
        const contractNumber = generateContractNumber()
        const contractData = {
          contractNumber,
          sale,
          generatedAt: new Date()
        }
        const contractHTML = generateContractHTML(contractData)

        await prisma.contract.create({
          data: {
            saleId: sale.id,
            contractNumber,
            content: contractHTML
          }
        })
      } catch (contractError) {
        console.error('Error auto-generating contract:', contractError)
        // Don't fail the sale creation if contract generation fails
      }

      return sale
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error('Error creating sale:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'This lot is already sold or reserved.' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Failed to create sale.' }, { status: 500 })
  }
}
