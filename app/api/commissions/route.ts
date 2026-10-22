import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, membershipWhere, financialDevelopmentAccessWhere } from '@/lib/access-control'
import { calculateCommissionAvailability, getCommissionReleaseContext, syncSaleCommissions } from '@/lib/commissions'
import { hasAnyDevelopmentPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const params = req.nextUrl.searchParams
  const mine = params.get('scope') === 'mine'
  // Broker access is temporarily disabled, including requests for their own data.
  if (!(await hasAnyDevelopmentPermission(userId, 'finance'))) return forbiddenResponse()
  const developmentId = params.get('developmentId') || undefined
  const status = params.get('status') || undefined
  const commissions = await prisma.saleCommission.findMany({
    where: {
      ...(mine ? { userId } : {}),
      sale: { lot: { block: { development: { ...(mine ? membershipWhere(userId) : financialDevelopmentAccessWhere(userId)), ...(developmentId ? { id: developmentId } : {}) } } } },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      payments: { orderBy: { paidAt: 'desc' }, select: { id: true, amount: true, paidAt: true } },
      sale: { select: { user: { select: { name: true } }, lot: { select: { identifier: true, block: { select: { identifier: true, development: { select: { id: true, name: true } } } } } } } },
    },
    orderBy: { createdAt: 'desc' },
  })
  await Promise.all([...new Set(commissions.map((item) => item.saleId))].map((saleId) => syncSaleCommissions(prisma, saleId)))
  const refreshed = await prisma.saleCommission.findMany({
    where: { id: { in: commissions.map((item) => item.id) }, ...(status ? { status } : {}) },
    include: {
      user: { select: { id: true, name: true, email: true } },
      payments: { orderBy: { paidAt: 'desc' }, select: { id: true, amount: true, paidAt: true } },
      sale: { select: { user: { select: { name: true } }, lot: { select: { identifier: true, block: { select: { identifier: true, development: { select: { id: true, name: true } } } } } } } },
    },
    orderBy: { createdAt: 'desc' },
  })
  const contexts = new Map(await Promise.all([...new Set(refreshed.map((item) => item.saleId))].map(async (saleId) => [saleId, await getCommissionReleaseContext(prisma, saleId)] as const)))
  return NextResponse.json(refreshed.map((commission) => {
    const paid = commission.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    return { ...commission, ...calculateCommissionAvailability(Number(commission.amount), paid, contexts.get(commission.saleId) ?? { entryPaidRatio: 0 }) }
  }))
}
