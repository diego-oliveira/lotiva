import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  persistInterWebhookEvents,
  type InterWebhookItem,
} from '@/lib/payments/webhooks'

export const runtime = 'nodejs'
type Params = { params: Promise<{ connectionId: string }> }

export async function POST(req: Request, { params }: Params) {
  const { connectionId } = await params
  const connection = await prisma.paymentProviderConnection.findUnique({
    where: { id: connectionId },
    select: {
      status: true,
      provider: true,
    },
  })
  if (!connection || connection.provider !== 'inter' || connection.status !== 'active') {
    return NextResponse.json({ error: 'Webhook nao configurado.' }, { status: 404 })
  }

  const payload = await req.json().catch(() => null) as InterWebhookItem[] | InterWebhookItem | null
  const events = Array.isArray(payload) ? payload : payload ? [payload] : []
  if (events.length === 0 || events.some((event) => !event.codigoSolicitacao)) {
    return NextResponse.json({ error: 'Evento invalido.' }, { status: 400 })
  }

  const result = await persistInterWebhookEvents({ connectionId, payload: events })
  return NextResponse.json({ received: true, ...result })
}
