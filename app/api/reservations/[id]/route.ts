import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, lotAccessWhere, reservationAccessWhere, userAccessWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'
import { createLotEvent } from '@/lib/lot-events'
import { hasDevelopmentPermission } from '@/lib/permissions'

type Params = { params: Promise<{ id: string }> }

export async function GET(_: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id

  const { id } = await params

  const reservation = await prisma.reservation.findFirst({
    where: {
      id,
      ...reservationAccessWhere(currentUserId),
    },
    include: { user: true, sale: true, lot: { include: { block: { include: { development: true } } } } },
  })

  if (!reservation) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  }

  return NextResponse.json(reservation)
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id

  const { id } = await params
  const data = await req.json()

  try {
    const [reservation, lot, user] = await Promise.all([
      prisma.reservation.findFirst({
        where: {
          id,
          ...reservationAccessWhere(currentUserId),
        },
        select: {
          id: true,
          lotId: true,
          status: true,
          createdById: true,
          lot: { select: { block: { select: { developmentId: true } } } },
        },
      }),
      prisma.lot.findFirst({
        where: {
          id: data.lotId,
          ...lotAccessWhere(currentUserId),
        },
        select: { id: true },
      }),
      prisma.user.findFirst({
        where: {
          id: data.userId,
          ...userAccessWhere(currentUserId),
        },
        select: { id: true, name: true },
      }),
    ])
    if (!reservation || !lot || !user) return forbiddenResponse()
    const developmentId = reservation.lot.block.developmentId
    const canManage =
      reservation.createdById === currentUserId ||
      Boolean(developmentId && await hasDevelopmentPermission(currentUserId, developmentId, 'admin'))
    if (!canManage) {
      return NextResponse.json(
        { error: 'Somente o responsavel pela reserva ou um administrador pode altera-la.' },
        { status: 403 },
      )
    }

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.reservation.update({
        where: { id: id },
        data: {
          userId: data.userId,
          lotId: data.lotId,
          proposal: data.proposal,
          status: data.status,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          cancelledAt: data.status === 'cancelled' ? new Date() : null,
          updatedAt: new Date(),
        },
      })

      await createLotEvent(tx, {
        lotId: data.lotId,
        userId: currentUserId,
        type: data.status === 'cancelled' ? 'reservation_cancelled' : 'reservation_updated',
        title: data.status === 'cancelled' ? 'Reserva cancelada' : 'Reserva atualizada',
        description: `Reserva de ${user.name} atualizada para ${data.status}.`,
        notes: data.proposal || null,
      })

      return saved
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'This lot already has a reservation.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: 'Unknown error.' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id

  const { id } = await params
  const reservation = await prisma.reservation.findFirst({
    where: {
      id,
      ...reservationAccessWhere(currentUserId),
    },
    include: {
      sale: true,
      lot: {
        include: {
          block: true,
        },
      },
    },
  })
  if (!reservation) return forbiddenResponse()
  const developmentId = reservation.lot.block.developmentId
  const canManage =
    reservation.createdById === currentUserId ||
    Boolean(developmentId && await hasDevelopmentPermission(currentUserId, developmentId, 'admin'))
  if (!canManage) {
    return NextResponse.json(
      { error: 'Somente o responsavel pela reserva ou um administrador pode liberar o lote.' },
      { status: 403 },
    )
  }
  if (reservation.sale) {
    return NextResponse.json({ error: 'Nao e possivel cancelar uma reserva convertida em venda.' }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
      },
    })

    await tx.lot.update({
      where: { id: reservation.lotId },
      data: { status: 'available' },
    })

    await createLotEvent(tx, {
      lotId: reservation.lotId,
      userId: currentUserId,
      type: 'reservation_cancelled',
      title: 'Reserva cancelada',
      description: 'Lote liberado para venda.',
    })
  })

  return NextResponse.json({ cancelled: true })
}
