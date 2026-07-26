import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, lotAccessWhere } from '@/lib/access-control'
import { createLotEvent } from '@/lib/lot-events'

type Params = { params: Promise<{ id: string }> }

const allowedStatuses = ['pending', 'contacted', 'dismissed'] as const

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const { id } = await params

  const data = await req.json().catch(() => ({}))
  const status = allowedStatuses.find((item) => item === data.status)
  if (!status) {
    return NextResponse.json({ error: 'Status invalido.' }, { status: 400 })
  }

  const interest = await prisma.publicLotInterest.findFirst({
    where: {
      id,
      lot: lotAccessWhere(userId),
    },
    include: {
      lot: {
        include: {
          block: { include: { development: true } },
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
  })
  if (!interest) return forbiddenResponse()

  const saved = await prisma.$transaction(async (tx) => {
    const updated = await tx.publicLotInterest.update({
      where: { id },
      data: { status },
      include: {
        lot: {
          include: {
            block: { include: { development: true } },
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
    })

    await createLotEvent(tx, {
      lotId: interest.lotId,
      userId,
      type: 'public_interest_updated',
      title: 'Solicitacao publica atualizada',
      description: `Solicitacao de ${interest.name} marcada como ${status}.`,
      notes: data.notes ? String(data.notes) : null,
    })

    return updated
  })

  return NextResponse.json(saved)
}
