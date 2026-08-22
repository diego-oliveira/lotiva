import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { blockAccessWhere, forbiddenResponse, lotAccessWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'
import { createLotEvent } from '@/lib/lot-events'
import { hasDevelopmentPermission } from '@/lib/permissions'

type Params = { params: Promise<{ id: string }> }

const allowedStatuses = new Set(['available', 'reserved', 'on_hold', 'sold'])

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
  const nextStatus = String(data.status || '')
  if (!allowedStatuses.has(nextStatus)) {
    return NextResponse.json({ error: 'Status do lote invalido.' }, { status: 400 })
  }

  const lot = await prisma.lot.findFirst({
    where: {
      id,
      ...lotAccessWhere(userId),
    },
    select: {
      id: true,
      identifier: true,
      status: true,
      front: true,
      back: true,
      leftSide: true,
      rightSide: true,
      totalArea: true,
      price: true,
      block: { select: { id: true, identifier: true, developmentId: true } },
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
    select: { id: true, identifier: true, developmentId: true },
  })
  if (!block) return forbiddenResponse()

  const hasLotDataChanges =
    lot.identifier !== data.identifier ||
    lot.block.id !== data.blockId ||
    lot.front !== data.front ||
    lot.back !== data.back ||
    lot.leftSide !== data.leftSide ||
    lot.rightSide !== data.rightSide ||
    lot.totalArea !== data.totalArea ||
    Number(lot.price) !== Number(data.price)
  const hasStatusChange = lot.status !== nextStatus
  const statusChangeRequiresAdmin = hasStatusChange && (
    lot.status === 'sold' ||
    nextStatus === 'sold' ||
    lot.status === 'reserved' ||
    nextStatus === 'reserved'
  )

  if (hasLotDataChanges || statusChangeRequiresAdmin) {
    const developmentId = lot.block.developmentId
    const canEditLot = Boolean(developmentId && await hasDevelopmentPermission(userId, developmentId, 'admin'))
    if (!canEditLot) {
      return NextResponse.json({ error: 'Somente administradores podem alterar dados cadastrais ou marcar lote como vendido.' }, { status: 403 })
    }
  }

  if (hasLotDataChanges && block.developmentId !== lot.block.developmentId) {
    if (!block.developmentId) {
      return NextResponse.json({ error: 'Quadra de destino sem empreendimento.' }, { status: 400 })
    }
    const canEditTargetDevelopment = await hasDevelopmentPermission(userId, block.developmentId, 'admin')
    if (!canEditTargetDevelopment) {
      return NextResponse.json({ error: 'Somente administradores do empreendimento de destino podem mover o lote.' }, { status: 403 })
    }
  }

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
        status: nextStatus,
        updatedAt: new Date(),
      },
    })

    const changes: string[] = []
    if (lot.identifier !== updatedLot.identifier) changes.push(`identificacao de ${lot.identifier} para ${updatedLot.identifier}`)
    if (lot.block.id !== updatedLot.blockId) changes.push(`quadra de ${lot.block.identifier} para ${block.identifier}`)
    if (lot.front !== updatedLot.front) changes.push(`frente de ${lot.front} m para ${updatedLot.front} m`)
    if (lot.back !== updatedLot.back) changes.push(`fundo de ${lot.back} m para ${updatedLot.back} m`)
    if (lot.leftSide !== updatedLot.leftSide) changes.push(`lateral esquerda de ${lot.leftSide} m para ${updatedLot.leftSide} m`)
    if (lot.rightSide !== updatedLot.rightSide) changes.push(`lateral direita de ${lot.rightSide} m para ${updatedLot.rightSide} m`)
    if (lot.totalArea !== updatedLot.totalArea) changes.push(`area de ${lot.totalArea} m2 para ${updatedLot.totalArea} m2`)

    if (changes.length > 0) {
      await createLotEvent(tx, {
        lotId: id,
        userId,
        type: 'lot_updated',
        title: 'Dados do lote alterados',
        description: `Alterado: ${changes.join('; ')}.`,
      })
    }

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

    if (Number(lot.price) !== Number(updatedLot.price)) {
      await createLotEvent(tx, {
        lotId: id,
        userId,
        type: 'lot_price_changed',
        title: 'Valor do lote alterado',
        description: `Valor alterado de ${Number(lot.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para ${Number(updatedLot.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
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
