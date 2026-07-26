import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, lotAccessWhere } from '@/lib/access-control'
import { createLotEvent } from '@/lib/lot-events'

type Params = { params: Promise<{ id: string }> }

const allowedStatuses = ['pending', 'contacted', 'dismissed'] as const

const interestInclude = {
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
  internalNoteEntries: {
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const { id } = await params

  const data = await req.json().catch(() => ({}))
  const hasStatus = data.status !== undefined
  const status = hasStatus ? allowedStatuses.find((item) => item === data.status) : undefined
  const hasInternalNotes = data.internalNotes !== undefined
  const internalNotes = hasInternalNotes ? String(data.internalNotes || '').trim() : undefined
  if (hasStatus && !status) {
    return NextResponse.json({ error: 'Status invalido.' }, { status: 400 })
  }
  if (!hasStatus && !hasInternalNotes) {
    return NextResponse.json({ error: 'Informe uma alteracao para salvar.' }, { status: 400 })
  }
  if (internalNotes && internalNotes.length > 2000) {
    return NextResponse.json({ error: 'A observacao interna deve ter ate 2000 caracteres.' }, { status: 400 })
  }

  const interest = await prisma.publicLotInterest.findFirst({
    where: {
      id,
      lot: lotAccessWhere(userId),
    },
    include: interestInclude,
  })
  if (!interest) return forbiddenResponse()

  const saved = await prisma.$transaction(async (tx) => {
    const updated = await tx.publicLotInterest.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(hasInternalNotes ? { internalNotes: internalNotes || null } : {}),
      },
      include: interestInclude,
    })

    if (internalNotes) {
      await tx.publicLotInterestNote.create({
        data: {
          interestId: interest.id,
          userId,
          note: internalNotes,
        },
      })
    }

    await createLotEvent(tx, {
      lotId: interest.lotId,
      userId,
      type: 'public_interest_updated',
      title: 'Solicitacao publica atualizada',
      description: status
        ? `Solicitacao de ${interest.name} marcada como ${status}.`
        : `Observacao interna adicionada para solicitacao de ${interest.name}.`,
      notes: hasInternalNotes ? internalNotes || null : data.notes ? String(data.notes) : null,
    })

    return tx.publicLotInterest.findUnique({
      where: { id: updated.id },
      include: interestInclude,
    })
  })

  return NextResponse.json(saved)
}
