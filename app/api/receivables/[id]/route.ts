import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, receivableAccessWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

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
  })

  if (!receivable) return forbiddenResponse()

  if (data.status === 'paid') {
    const paidAmount = Number(data.paidAmount ?? receivable.amount)
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      return NextResponse.json({ error: 'Valor pago invalido.' }, { status: 400 })
    }

    const updated = await prisma.receivable.update({
      where: { id },
      data: {
        status: 'paid',
        paidAmount,
        balance: Math.max(receivable.amount - paidAmount, 0),
        paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
      },
    })

    return NextResponse.json(updated)
  }

  if (data.status === 'pending') {
    const updated = await prisma.receivable.update({
      where: { id },
      data: {
        status: 'pending',
        paidAmount: 0,
        balance: receivable.amount,
        paidAt: null,
      },
    })

    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Status invalido.' }, { status: 400 })
}
