import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, lotAccessWhere, reservationAccessWhere, saleAccessWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

function parseDateOnly(value?: string | null) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day, 12)
}

export async function GET(_: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id

  const { id } = await params

  const sale = await prisma.sale.findFirst({
    where: {
      id,
      ...saleAccessWhere(currentUserId),
    },
    include: {
      user: true,
      lot: {
        include: {
          block: { include: { development: true } }
        }
      },
      reservation: true,
      receivables: {
        orderBy: [
          { dueDate: 'asc' },
          { sequence: 'asc' },
        ],
      },
    }
  })

  if (!sale) {
    return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
  }

  return NextResponse.json(sale)
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id

  const { id } = await params
  const data = await req.json()

  try {
    const existingSale = await prisma.sale.findFirst({
      where: {
        id,
        ...saleAccessWhere(currentUserId),
      },
      select: { id: true },
    })
    if (!existingSale) return forbiddenResponse()

    const lot = await prisma.lot.findFirst({
      where: {
        id: data.lotId,
        ...lotAccessWhere(currentUserId),
      },
      include: {
        block: {
          select: {
            developmentId: true,
          },
        },
      },
    })
    if (!lot?.block.developmentId) return forbiddenResponse()

    const buyerMembership = await prisma.developmentUser.findUnique({
      where: {
        developmentId_userId: {
          developmentId: lot.block.developmentId,
          userId: data.userId,
        },
      },
      select: { id: true },
    })
    if (!buyerMembership) return forbiddenResponse()

    if (data.reservationId) {
      const reservation = await prisma.reservation.findFirst({
        where: {
          id: data.reservationId,
          lotId: data.lotId,
          userId: data.userId,
          ...reservationAccessWhere(currentUserId),
        },
        select: { id: true },
      })
      if (!reservation) return forbiddenResponse()
    }

    const updated = await prisma.sale.update({
      where: { id },
      data: {
        userId: data.userId,
        lotId: data.lotId,
        reservationId: data.reservationId || null,
        installmentCount: data.installmentCount,
        installmentValue: data.installmentValue,
        downPayment: data.downPayment,
        firstDueDate: parseDateOnly(data.firstDueDate),
        annualAdjustment: data.annualAdjustment,
        totalValue: data.totalValue,
        updatedAt: new Date(),
      },
      include: {
        user: true,
        lot: {
          include: {
            block: true
          }
        },
        reservation: true,
        receivables: {
          orderBy: [
            { dueDate: 'asc' },
            { sequence: 'asc' },
          ],
        },
      }
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error updating sale:', error)
    return NextResponse.json({ error: 'Failed to update sale.' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id

  const { id } = await params

  try {
    const canAccessSale = await prisma.sale.findFirst({
      where: {
        id,
        ...saleAccessWhere(currentUserId),
      },
      select: { id: true },
    })
    if (!canAccessSale) return forbiddenResponse()

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
