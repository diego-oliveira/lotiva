import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { hasCompanyPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { reconcilePaymentConnection } from '@/lib/payments/reconciliation'

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const data = await req.json()
  const connection = await prisma.paymentProviderConnection.findUnique({
    where: { id: String(data.connectionId || '') },
  })
  if (!connection || !(await hasCompanyPermission(
    auth.session.user.id,
    connection.companyId,
    'reconcilePayments',
  ))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    return NextResponse.json(await reconcilePaymentConnection({
      connectionId: connection.id,
      trigger: 'manual',
    }))
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Nao foi possivel conciliar.',
    }, { status: 400 })
  }
}
