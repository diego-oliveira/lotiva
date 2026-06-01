import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, receivableAccessWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'
import { createLotEvent } from '@/lib/lot-events'

type Params = { params: Promise<{ id: string }> }

function parseDateOnly(value?: string | null) {
  if (!value) return new Date()
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return new Date()
  return new Date(year, month - 1, day, 12)
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id

  const { id } = await params
  const data = await req.json()

  const receivable = await prisma.receivable.findFirst({
    where: {
      id,
      ...receivableAccessWhere(currentUserId),
    },
    include: {
      sale: {
        include: {
          user: true,
          lot: true,
        },
      },
    },
  })

  if (!receivable) return forbiddenResponse()

  if (data.status === 'paid') {
    const paidAmount = Number(data.paidAmount ?? receivable.amount)
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      return NextResponse.json({ error: 'Valor pago invalido.' }, { status: 400 })
    }

    const balance = Math.max(receivable.amount - paidAmount, 0)
    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.receivable.update({
        where: { id },
        data: {
          status: balance > 0 ? 'pending' : 'paid',
          paidAmount,
          balance,
          paidAt: parseDateOnly(data.paidAt),
          notes: typeof data.notes === 'string' ? data.notes.trim() || null : receivable.notes,
        },
      })

      await createLotEvent(tx, {
        lotId: receivable.sale.lotId,
        userId: currentUserId,
        type: 'payment_registered',
        title: 'Pagamento registrado',
        description: `${receivable.kind === 'down_payment' ? 'Entrada' : `Parcela ${receivable.sequence}`} de ${receivable.sale.user.name}: ${paidAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
        notes: typeof data.notes === 'string' ? data.notes.trim() || null : null,
      })

      return saved
    })

    return NextResponse.json(updated)
  }

  if (data.status === 'pending') {
    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.receivable.update({
        where: { id },
        data: {
          status: 'pending',
          paidAmount: 0,
          balance: receivable.amount,
          paidAt: null,
          notes: typeof data.notes === 'string' ? data.notes.trim() || null : receivable.notes,
        },
      })

      await createLotEvent(tx, {
        lotId: receivable.sale.lotId,
        userId: currentUserId,
        type: 'payment_reopened',
        title: 'Pagamento reaberto',
        description: `${receivable.kind === 'down_payment' ? 'Entrada' : `Parcela ${receivable.sequence}`} voltou para em aberto.`,
      })

      return saved
    })

    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Status invalido.' }, { status: 400 })
}
