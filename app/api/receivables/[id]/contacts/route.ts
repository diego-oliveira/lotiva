import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, receivableAccessWhere } from '@/lib/access-control'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const { id } = await params
  const receivable = await prisma.receivable.findFirst({
    where: { id, ...receivableAccessWhere(userId) },
    select: { id: true, sale: { select: { lot: { select: { block: { select: { developmentId: true } } } } } } },
  })
  const developmentId = receivable?.sale.lot.block.developmentId
  if (!receivable || !developmentId || !(await hasDevelopmentPermission(userId, developmentId, 'issuePayments'))) {
    return forbiddenResponse()
  }

  const data = await req.json().catch(() => ({}))
  const category = data.category === 'overdue' ? 'overdue' : data.category === 'boleto' ? 'boleto' : null
  const channel = ['email', 'whatsapp', 'phone', 'other'].includes(data.channel) ? data.channel : null
  if (!category || !channel) return NextResponse.json({ error: 'Informe o tipo de contato e o canal.' }, { status: 400 })

  const contact = await prisma.receivableContactLog.create({
    data: {
      receivableId: id,
      userId,
      category,
      channel,
      message: typeof data.message === 'string' ? data.message.slice(0, 4000) : null,
    },
    include: { user: { select: { name: true } } },
  })
  return NextResponse.json(contact, { status: 201 })
}
