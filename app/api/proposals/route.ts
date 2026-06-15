import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, lotAccessWhere, proposalAccessWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'
import { createLotEvent } from '@/lib/lot-events'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { calculateInstallment, evaluateProposalTerms } from '@/lib/proposal-rules'
import { addMoney, decimal, moneyToNumber, multiplyMoney, subtractMoney } from '@/lib/money'

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toInt(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0
}

function parseDate(value: unknown) {
  if (typeof value !== 'string' || !value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getDefaultExpiration(days = 7) {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + days)
  return expiresAt
}

export async function GET() {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id

  const proposals = await prisma.proposal.findMany({
    where: proposalAccessWhere(currentUserId),
    include: {
      user: true,
      createdBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
      lot: {
        include: {
          block: { include: { development: true } },
        },
      },
      reservation: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const reviewMemberships = await prisma.developmentUser.findMany({
    where: {
      userId: currentUserId,
      roles: {
        some: {
          role: {
            name: {
              in: ['owner', 'administrador', 'admin'],
              mode: 'insensitive',
            },
          },
        },
      },
    },
    select: { developmentId: true },
  })
  const reviewDevelopmentIds = new Set(reviewMemberships.map((membership) => membership.developmentId))

  return NextResponse.json(
    proposals.map((proposal) => ({
      ...proposal,
      canReview: proposal.lot.block.development?.id
        ? reviewDevelopmentIds.has(proposal.lot.block.development.id)
        : false,
    })),
  )
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id

  try {
    const data = await req.json()
    const lot = await prisma.lot.findFirst({
      where: {
        id: data.lotId,
        ...lotAccessWhere(currentUserId),
      },
      include: {
        sale: true,
        block: {
          include: {
            development: {
              include: { settings: true },
            },
          },
        },
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

    const salePrice = toNumber(data.salePrice)
    const downPayment = toNumber(data.downPayment)
    const installmentCount = toInt(data.installmentCount)
    const interestRate = toNumber(data.interestRate)
    const interestCalculation = data.interestCalculation || 'none'
    const correctionIndex = data.correctionIndex || 'none'
    const correctionFrequency = data.correctionFrequency || 'monthly'
    const balance = moneyToNumber(subtractMoney(salePrice, downPayment))
    const installmentValue = moneyToNumber(decimal(
      calculateInstallment(balance, installmentCount, interestRate, interestCalculation),
    ))
    const totalValue = moneyToNumber(addMoney(
      downPayment,
      multiplyMoney(installmentValue, installmentCount),
    ))

    if (salePrice <= 0 || downPayment < 0 || downPayment > salePrice || installmentCount <= 0 || installmentValue <= 0) {
      return NextResponse.json({ error: 'Revise a condicao comercial antes de salvar a proposta.' }, { status: 400 })
    }

    const settings = lot.block.development?.settings ?? {
      minDownPaymentPercentage: 10,
      maxInstallments: 120,
      defaultInterestRate: 0,
      interestCalculation: 'none',
      correctionIndex: 'none',
      correctionFrequency: 'monthly',
      allowCustomTerms: true,
    }
    const evaluation = evaluateProposalTerms(settings, {
      basePrice: Number(lot.price),
      salePrice,
      downPayment,
      installmentCount,
      interestRate,
      interestCalculation,
      correctionIndex,
      correctionFrequency,
    })
    if (!evaluation.canSubmit) {
      return NextResponse.json(
        { error: 'A proposta esta fora das regras comerciais e o empreendimento nao permite excecoes.' },
        { status: 400 },
      )
    }

    const existingReservation = lot.reservations[0] ?? null
    const reservationIsActive = existingReservation && !existingReservation.cancelledAt && existingReservation.status !== 'cancelled'
    if (reservationIsActive && existingReservation.userId !== data.userId) {
      return NextResponse.json({ error: 'Este lote ja esta reservado para outro cliente.' }, { status: 409 })
    }
    if (
      reservationIsActive &&
      existingReservation.createdById !== currentUserId &&
      !(await hasDevelopmentPermission(currentUserId, lot.block.developmentId, 'admin'))
    ) {
      return NextResponse.json(
        { error: 'Somente o responsavel pela reserva ou um administrador pode altera-la.' },
        { status: 403 },
      )
    }

    const fallbackDays = lot.block.development?.settings?.reservationValidityDays ?? 7
    const reservationProposal = data.notes || `Proposta de ${totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`

    const proposal = await prisma.$transaction(async (tx) => {
      const reservation = existingReservation
        ? await tx.reservation.update({
            where: { id: existingReservation.id },
            data: {
              userId: data.userId,
              proposal: reservationProposal,
              status: 'active',
              expiresAt: getDefaultExpiration(fallbackDays),
              cancelledAt: null,
              createdById: reservationIsActive
                ? existingReservation.createdById
                : currentUserId,
            },
          })
        : await tx.reservation.create({
            data: {
              userId: data.userId,
              createdById: currentUserId,
              lotId: data.lotId,
              proposal: reservationProposal,
              status: 'active',
              expiresAt: getDefaultExpiration(fallbackDays),
            },
          })

      await tx.lot.update({
        where: { id: data.lotId },
        data: { status: 'reserved' },
      })

      const savedProposal = await tx.proposal.create({
        data: {
          lotId: data.lotId,
          userId: data.userId,
          createdById: currentUserId,
          reservationId: reservation.id,
          status: evaluation.status,
          exceptionReasons: evaluation.reasons.join('\n') || null,
          salePrice,
          downPayment,
          installmentCount,
          installmentValue,
          balance,
          totalValue,
          interestRate,
          interestCalculation,
          correctionIndex,
          correctionFrequency,
          firstDueDate: parseDate(data.firstDueDate),
          notes: data.notes || null,
        },
        include: {
          user: true,
          createdBy: { select: { id: true, name: true, email: true } },
          lot: { include: { block: { include: { development: true } } } },
          reservation: true,
        },
      })

      await createLotEvent(tx, {
        lotId: data.lotId,
        userId: currentUserId,
        type: evaluation.status === 'approved' ? 'proposal_auto_approved' : 'proposal_pending_approval',
        title: evaluation.status === 'approved' ? 'Proposta aprovada automaticamente' : 'Proposta aguardando aprovacao',
        description: evaluation.status === 'approved'
          ? `Proposta de ${totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para ${savedProposal.user.name} dentro das regras comerciais.`
          : `Proposta de ${totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para ${savedProposal.user.name} enviada para aprovacao.`,
        notes: data.notes || null,
      })

      if (evaluation.status === 'pending_approval') {
        const administrators = await tx.developmentUser.findMany({
          where: {
            developmentId: lot.block.developmentId!,
            roles: {
              some: {
                role: {
                  name: {
                    in: ['owner', 'administrador', 'admin'],
                    mode: 'insensitive',
                  },
                },
              },
            },
          },
          select: { userId: true },
        })

        const recipients = administrators.filter((administrator) => administrator.userId !== currentUserId)
        if (recipients.length > 0) {
          await tx.notification.createMany({
            data: recipients.map((administrator) => ({
              userId: administrator.userId,
              type: 'proposal_pending_approval',
              title: 'Proposta aguardando aprovacao',
              message: `${savedProposal.createdBy.name} enviou uma proposta com condicoes excepcionais para ${savedProposal.user.name}.`,
              href: `/proposals?proposalId=${savedProposal.id}`,
            })),
          })
        }
      }

      return savedProposal
    })

    return NextResponse.json(proposal, { status: 201 })
  } catch (error) {
    console.error('POST /api/proposals:', error)
    return NextResponse.json({ error: 'Erro ao salvar proposta.' }, { status: 500 })
  }
}
