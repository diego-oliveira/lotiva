import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, lotAccessWhere } from '@/lib/access-control'
import { createLotEvent } from '@/lib/lot-events'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id

  const { id } = await params
  const data = await req.json()
  const notes = typeof data.notes === 'string' ? data.notes.trim() : ''

  if (!notes) {
    return NextResponse.json({ error: 'Informe uma observacao.' }, { status: 400 })
  }

  const lot = await prisma.lot.findFirst({
    where: {
      id,
      ...lotAccessWhere(currentUserId),
    },
    select: { id: true },
  })
  if (!lot) return forbiddenResponse()

  const event = await createLotEvent(prisma, {
    lotId: id,
    userId: currentUserId,
    type: 'manual_note',
    title: 'Observacao registrada',
    notes,
  })

  return NextResponse.json(event, { status: 201 })
}
