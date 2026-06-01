// app/api/lots/route.ts
import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, lotAccessWhere, blockAccessWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'
import { createLotEvent } from '@/lib/lot-events'

export async function GET() {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const lots = await prisma.lot.findMany({
    where: lotAccessWhere(userId),
    include: {
      block: { include: { development: { include: { settings: true } } } },
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
        include: {
          user: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      events: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(lots)
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
