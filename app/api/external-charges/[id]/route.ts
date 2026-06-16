import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse } from '@/lib/access-control'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { cancelExternalCharge, reissueExternalCharge } from '@/lib/payments/charge-actions'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const { id } = await params
  const charge = await prisma.externalCharge.findUnique({
    where: { id },
    select: {
      receivable: {
        select: {
          sale: {
            select: {
              lot: { select: { block: { select: { developmentId: true } } } },
            },
          },
        },
      },
    },
  })
  const developmentId = charge?.receivable.sale.lot.block.developmentId
  if (!developmentId || !(await hasDevelopmentPermission(auth.session.user.id, developmentId, 'cancelPayments'))) {
    return forbiddenResponse()
  }

  try {
    const data = await req.json()
    const reason = String(data.reason || '')
    const result = data.action === 'reissue'
      ? await reissueExternalCharge({ externalChargeId: id, actorId: auth.session.user.id, reason })
      : await cancelExternalCharge({ externalChargeId: id, actorId: auth.session.user.id, reason })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Nao foi possivel alterar a cobranca.',
    }, { status: 400 })
  }
}
