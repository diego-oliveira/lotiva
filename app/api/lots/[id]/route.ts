import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }


export async function GET(_: Request, { params }: Params) {
  const { id } = await params

  const lot = await prisma.lot.findUnique({
    where: { id: id },
    include: { block: true },
  })

  if (!lot) {
    return NextResponse.json({ error: 'Lot not found' }, { status: 404 })
  }

  return NextResponse.json(lot)
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params
  const data = await req.json()

  const updated = await prisma.lot.update({
    where: { id: id },
    data: {
      identifier: data.identifier,
      blockId: data.blockId,
      front: data.front,
      back: data.back,
      leftSide: data.leftSide,
      rightSide: data.rightSide,
      totalArea: data.totalArea,
      price: data.price,
      updatedAt: new Date(),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params

  await prisma.lot.delete({
    where: { id: id },
  })

  return NextResponse.json({ deleted: true })
}
