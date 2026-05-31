// app/api/lots/route.ts
import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, lotAccessWhere, blockAccessWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const lots = await prisma.lot.findMany({
    where: lotAccessWhere(userId),
    include: {
      block: { include: { development: true } },
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

  const newLot = await prisma.lot.create({
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

  return NextResponse.json(newLot, { status: 201 })
}
