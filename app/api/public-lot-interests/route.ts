import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { lotAccessWhere } from '@/lib/access-control'

export async function GET() {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const interests = await prisma.publicLotInterest.findMany({
    where: {
      lot: lotAccessWhere(userId),
    },
    include: {
      lot: {
        include: {
          block: {
            include: {
              development: true,
            },
          },
          sale: { select: { id: true } },
          reservations: {
            where: {
              cancelledAt: null,
              status: { not: 'cancelled' },
              sale: null,
            },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(interests)
}
