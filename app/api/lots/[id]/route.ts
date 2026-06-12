import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { blockAccessWhere, forbiddenResponse, lotAccessWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'
import { createLotEvent } from '@/lib/lot-events'
import { hasDevelopmentPermission } from '@/lib/permissions'

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
    select: {
      id: true,
      status: true,
      price: true,
      block: { select: { developmentId: true } },
      events: {
        where: { type: 'lot_blocked' },
        select: { userId: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })
  if (!lot) return forbiddenResponse()

  if (lot.status === 'on_hold' && data.status === 'available') {
    const developmentId = lot.block.developmentId
    const blockedById = lot.events[0]?.userId
    const canRelease =
      blockedById === userId ||
      Boolean(developmentId && await hasDevelopmentPermission(userId, developmentId, 'admin'))
    if (!canRelease) {
      return NextResponse.json(
        { error: 'Somente quem bloqueou o lote ou um administrador pode libera-lo.' },
        { status: 403 },
      )
    }
  }

  const block = await prisma.block.findFirst({
    where: {
      id: data.blockId,
      ...blockAccessWhere(userId),
    },
    select: { id: true },
  })
  if (!block) return forbiddenResponse()

  const updated = await prisma.$transaction(async (tx) => {
    const updatedLot = await tx.lot.update({
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

    if (lot.status !== updatedLot.status) {
      const blocked = updatedLot.status === 'on_hold'
      await createLotEvent(tx, {
        lotId: id,
        userId,
        type: blocked ? 'lot_blocked' : 'lot_status_changed',
        title: blocked ? 'Lote bloqueado' : 'Status do lote alterado',
        description: `Status alterado de ${lot.status} para ${updatedLot.status}.`,
      })
    }

    if (lot.price !== updatedLot.price) {
      await createLotEvent(tx, {
        lotId: id,
        userId,
        type: 'lot_price_changed',
        title: 'Valor do lote alterado',
        description: `Valor alterado de ${lot.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para ${updatedLot.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
      })
    }

    return updatedLot
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
