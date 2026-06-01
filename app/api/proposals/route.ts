import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, lotAccessWhere, proposalAccessWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'
import { createLotEvent } from '@/lib/lot-events'
import { hasDevelopmentPermission } from '@/lib/permissions'

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
      lot: {
        include: {
          block: { include: { development: true } },
        },
      },
      reservation: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(proposals)
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
    const installmentValue = toNumber(data.installmentValue)
    const balance = toNumber(data.balance)
    const totalValue = toNumber(data.totalValue)
    const interestRate = toNumber(data.interestRate)

    if (salePrice <= 0 || downPayment < 0 || downPayment > salePrice || installmentCount <= 0 || installmentValue <= 0) {
      return NextResponse.json({ error: 'Revise a condicao comercial antes de salvar a proposta.' }, { status: 400 })
    }

    const existingReservation = lot.reservations[0] ?? null
    const reservationIsActive = existingReservation && !existingReservation.cancelledAt && existingReservation.status !== 'cancelled'
    if (reservationIsActive && existingReservation.userId !== data.userId) {
      return NextResponse.json({ error: 'Este lote ja esta reservado para outro cliente.' }, { status: 409 })
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
            },
          })
        : await tx.reservation.create({
            data: {
              userId: data.userId,
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
          reservationId: reservation.id,
          status: data.status || 'draft',
          salePrice,
          downPayment,
          installmentCount,
          installmentValue,
          balance,
          totalValue,
          interestRate,
          interestCalculation: data.interestCalculation || 'none',
          correctionIndex: data.correctionIndex || 'none',
          correctionFrequency: data.correctionFrequency || 'monthly',
          firstDueDate: parseDate(data.firstDueDate),
          notes: data.notes || null,
        },
        include: {
          user: true,
          lot: { include: { block: { include: { development: true } } } },
          reservation: true,
        },
      })

      await createLotEvent(tx, {
        lotId: data.lotId,
        userId: currentUserId,
        type: 'proposal_created',
        title: 'Proposta registrada',
        description: `Proposta de ${totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para ${savedProposal.user.name}.`,
        notes: data.notes || null,
      })

      return savedProposal
    })

    return NextResponse.json(proposal, { status: 201 })
  } catch (error) {
    console.error('POST /api/proposals:', error)
    return NextResponse.json({ error: 'Erro ao salvar proposta.' }, { status: 500 })
  }
}
