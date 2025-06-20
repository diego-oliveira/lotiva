// app/api/reservations/route.ts
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const reservations = await prisma.reservation.findMany({
    include: { customer: true, lot: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(reservations)
}

export async function POST(req: Request) {
  const data = await req.json()

  try {
    const reservation = await prisma.reservation.create({
      data: {
        customerId: data.customerId,
        lotId: data.lotId,
        proposal: data.proposal,
        status: data.status,
      },
    })

    return NextResponse.json(reservation, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'This lot already has a reservation.' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Unknown error.' }, { status: 500 })
  }
}
