// app/api/lots/route.ts
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const lots = await prisma.lot.findMany({
    include: { block: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(lots)
}

export async function POST(req: Request) {
  const data = await req.json()

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
