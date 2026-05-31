import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { blockAccessWhere, forbiddenResponse, lotAccessWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }


export async function GET(_: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const { id } = await params

  const lot = await prisma.lot.findFirst({
    where: {
      id,
      ...lotAccessWhere(userId),
    },
    include: { block: { include: { development: true } } },
  })

  if (!lot) {
    return NextResponse.json({ error: 'Lot not found' }, { status: 404 })
  }

  return NextResponse.json(lot)
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const { id } = await params
  const data = await req.json()
  const lot = await prisma.lot.findFirst({
    where: {
      id,
      ...lotAccessWhere(userId),
    },
    select: { id: true },
  })
  if (!lot) return forbiddenResponse()

  const block = await prisma.block.findFirst({
    where: {
      id: data.blockId,
      ...blockAccessWhere(userId),
    },
    select: { id: true },
  })
  if (!block) return forbiddenResponse()

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
      status: data.status,
      updatedAt: new Date(),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const { id } = await params
  const lot = await prisma.lot.findFirst({
    where: {
      id,
      ...lotAccessWhere(userId),
    },
    select: { id: true },
  })
  if (!lot) return forbiddenResponse()

  await prisma.lot.delete({
    where: { id: id },
  })

  return NextResponse.json({ deleted: true })
}
