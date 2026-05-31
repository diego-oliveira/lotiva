import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, lotAccessWhere, reservationAccessWhere, userAccessWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'

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
    include: { user: true, lot: { include: { block: { include: { development: true } } } } },
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
        select: { id: true },
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
        select: { id: true },
      }),
    ])
    if (!reservation || !lot || !user) return forbiddenResponse()

    const updated = await prisma.reservation.update({
      where: { id: id },
      data: {
        userId: data.userId,
        lotId: data.lotId,
        proposal: data.proposal,
        status: data.status,
        updatedAt: new Date(),
      },
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
    select: { id: true },
  })
  if (!reservation) return forbiddenResponse()

  await prisma.reservation.delete({
    where: { id: id },
  })

  return NextResponse.json({ deleted: true })
}
