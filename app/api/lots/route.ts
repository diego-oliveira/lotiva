// app/api/lots/route.ts
import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, lotAccessWhere, blockAccessWhere, lotEventAccessWhere, proposalAccessWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'
import { createLotEvent } from '@/lib/lot-events'

export async function GET() {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const lots = await prisma.lot.findMany({
    where: lotAccessWhere(userId),
    include: {
      block: { include: { development: { include: { settings: true, map: true } } } },
      reservations: {
        include: {
          user: true,
          sale: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      sale: {
        include: {
          user: true,
          contract: true,
        },
      },
      proposals: {
        where: proposalAccessWhere(userId),
        include: {
          user: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      events: {
        where: lotEventAccessWhere(userId),
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  const adminMemberships = await prisma.developmentUser.findMany({
    where: {
      userId,
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
  const adminDevelopmentIds = new Set(adminMemberships.map((membership) => membership.developmentId))

  const proposalCandidates = await prisma.proposal.findMany({
    where: {
      lotId: { in: lots.map((lot) => lot.id) },
    },
    select: {
      id: true,
      lotId: true,
      userId: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  const latestProposalByBuyerAndLot = new Map<string, typeof proposalCandidates[number]>()
  proposalCandidates.forEach((proposal) => {
    const key = `${proposal.lotId}:${proposal.userId}`
    if (!latestProposalByBuyerAndLot.has(key)) latestProposalByBuyerAndLot.set(key, proposal)
  })

  return NextResponse.json(
    lots.map((lot) => {
      const developmentId = lot.block.development?.id
      const isDevelopmentAdmin = Boolean(developmentId && adminDevelopmentIds.has(developmentId))
      const latestBlockEvent = lot.events.find((event) => event.type === 'lot_blocked')
      const reservation = lot.reservations.find(
        (item) => !item.cancelledAt && item.status !== 'cancelled' && !item.sale,
      )
      const reservations = lot.reservations.map((item) => ({
        ...item,
        canManage: item.createdById === userId || isDevelopmentAdmin,
      }))
      const canReleaseHold = latestBlockEvent?.userId === userId || isDevelopmentAdmin
      if (!reservation) return { ...lot, reservations, canReleaseHold, saleEligibility: null }

      const latestProposal = latestProposalByBuyerAndLot.get(`${lot.id}:${reservation.userId}`)
      const visibleProposal = latestProposal
        ? lot.proposals.find((proposal) => proposal.id === latestProposal.id)
        : null

      return {
        ...lot,
        reservations,
        canReleaseHold,
        saleEligibility: {
          userId: reservation.userId,
          canConvert: !latestProposal || Boolean(visibleProposal && latestProposal.status === 'approved'),
          requiresApproval: Boolean(latestProposal && latestProposal.status !== 'approved'),
          proposalId: visibleProposal && latestProposal?.status === 'approved' ? visibleProposal.id : null,
        },
      }
    }),
  )
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const data = await req.json()
  const block = await prisma.block.findFirst({
    where: {
      id: data.blockId,
      ...blockAccessWhere(userId),
    },
    select: { id: true },
  })
  if (!block) return forbiddenResponse()

  const newLot = await prisma.$transaction(async (tx) => {
    const lot = await tx.lot.create({
      data: {
        identifier: data.identifier,
        blockId: data.blockId,
        front: data.front,
        back: data.back,
        leftSide: data.leftSide,
        rightSide: data.rightSide,
        totalArea: data.totalArea,
        price: data.price,
        status: data.status || 'available',
      },
    })

    await createLotEvent(tx, {
      lotId: lot.id,
      userId,
      type: 'lot_created',
      title: 'Lote cadastrado',
      description: `Lote ${lot.identifier} criado com status ${lot.status}.`,
    })

    return lot
  })

  return NextResponse.json(newLot, { status: 201 })
}
