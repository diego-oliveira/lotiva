import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_: Request, { params }: Params) {
  const { id } = await params

  const reservation = await prisma.reservation.findUnique({
    where: { id: id },
    include: { customer: true, lot: true },
  })

  if (!reservation) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  }

  return NextResponse.json(reservation)
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params
  const data = await req.json()

  try {
    const updated = await prisma.reservation.update({
      where: { id: id },
      data: {
        customerId: data.customerId,
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
  const { id } = await params

  await prisma.reservation.delete({
    where: { id: id },
  })

  return NextResponse.json({ deleted: true })
}
