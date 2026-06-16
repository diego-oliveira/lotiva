import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { hasCompanyPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { processPendingWebhookEvents } from '@/lib/payments/webhooks'

type Params = { params: Promise<{ id: string }> }

export async function POST(_: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const { id } = await params
  const event = await prisma.paymentWebhookEvent.findUnique({
    where: { id },
    include: { connection: true },
  })
  if (!event || !(await hasCompanyPermission(
    auth.session.user.id,
    event.connection.companyId,
    'reconcilePayments',
  ))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.paymentWebhookEvent.update({
    where: { id },
    data: {
      status: 'pending',
      nextAttemptAt: null,
      errorMessage: null,
    },
  })
  const result = await processPendingWebhookEvents({ limit: 100 })
  return NextResponse.json(result)
}
