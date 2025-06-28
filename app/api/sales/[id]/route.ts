import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_: Request, { params }: Params) {
  const { id } = await params

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      customer: true,
      lot: {
        include: {
          block: true
        }
      },
      reservation: true
    }
  })

  if (!sale) {
    return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
  }

  return NextResponse.json(sale)
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params
  const data = await req.json()

  try {
    const updated = await prisma.sale.update({
      where: { id },
      data: {
        customerId: data.customerId,
        lotId: data.lotId,
        reservationId: data.reservationId || null,
        installmentCount: data.installmentCount,
        installmentValue: data.installmentValue,
        downPayment: data.downPayment,
        annualAdjustment: data.annualAdjustment,
        totalValue: data.totalValue,
        updatedAt: new Date(),
      },
      include: {
        customer: true,
        lot: {
          include: {
            block: true
          }
        },
        reservation: true
      }
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error updating sale:', error)
    return NextResponse.json({ error: 'Failed to update sale.' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params

  try {
    // Start a transaction to ensure data consistency
    await prisma.$transaction(async (prisma) => {
      // Get the sale to find the lot ID
      const sale = await prisma.sale.findUnique({
        where: { id },
        select: { lotId: true }
      })

      if (!sale) {
        throw new Error('Sale not found')
      }

      // Delete the sale
      await prisma.sale.delete({
        where: { id }
      })

      // Update lot status back to available
      await prisma.lot.update({
        where: { id: sale.lotId },
        data: { status: 'available' }
      })
    })

    return NextResponse.json({ deleted: true })
  } catch (error: any) {
    console.error('Error deleting sale:', error)
    return NextResponse.json({ error: 'Failed to delete sale.' }, { status: 500 })
  }
}