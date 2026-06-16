import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse } from '@/lib/access-control'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { reviewAdjustment } from '@/lib/payments/adjustments'

type Params = { params: Promise<{ id: string; reviewId: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const { id, reviewId } = await params
  const review = await prisma.adjustmentReview.findFirst({
    where: { id: reviewId, saleId: id },
    select: {
      sale: {
        select: {
          lot: { select: { block: { select: { developmentId: true } } } },
        },
      },
    },
  })
  const developmentId = review?.sale.lot.block.developmentId
  if (!developmentId || !(await hasDevelopmentPermission(auth.session.user.id, developmentId, 'approveAdjustments'))) {
    return forbiddenResponse()
  }

  try {
    const data = await req.json()
    const action = data.action === 'reject' ? 'reject' : 'approve'
    return NextResponse.json(await reviewAdjustment({
      reviewId,
      reviewerId: auth.session.user.id,
      action,
      rejectionReason: typeof data.rejectionReason === 'string' ? data.rejectionReason : undefined,
    }))
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Nao foi possivel analisar o reajuste.',
    }, { status: 400 })
  }
}
