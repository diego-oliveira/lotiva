import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { processPendingWebhookEvents } from '@/lib/payments/webhooks'
import { reconcileAllActiveConnections } from '@/lib/payments/reconciliation'
import { createAdjustmentCycleAlerts } from '@/lib/payments/adjustment-alerts'

export const runtime = 'nodejs'

function authorized(req: Request) {
  const expected = process.env.CRON_SECRET || ''
  const received = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  const left = Buffer.from(expected)
  const right = Buffer.from(received)
  return Boolean(expected) && left.length === right.length && timingSafeEqual(left, right)
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Job nao autorizado.' }, { status: 401 })
  }
  const mode = new URL(req.url).searchParams.get('mode') || 'events'
  const webhooks = await processPendingWebhookEvents({ limit: 200 })
  if (mode === 'events') {
    console.info(JSON.stringify({ scope: 'payments_job', mode, webhooks, completedAt: new Date().toISOString() }))
    return NextResponse.json({ webhooks })
  }

  const reconciliation = await reconcileAllActiveConnections()
  const alerts = await createAdjustmentCycleAlerts()
  console.info(JSON.stringify({
    scope: 'payments_job',
    mode,
    webhooks,
    reconciliationRuns: reconciliation.length,
    alerts,
    completedAt: new Date().toISOString(),
  }))
  return NextResponse.json({ webhooks, reconciliation, alerts })
}
