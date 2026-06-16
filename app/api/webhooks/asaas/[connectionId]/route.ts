import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptPaymentCredential } from '@/lib/payments/credentials'
import {
  persistAsaasWebhookEvent,
  type AsaasWebhookPayload,
} from '@/lib/payments/webhooks'

export const runtime = 'nodejs'
type Params = { params: Promise<{ connectionId: string }> }

function secureTokenEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export async function POST(req: Request, { params }: Params) {
  const { connectionId } = await params
  const connection = await prisma.paymentProviderConnection.findUnique({
    where: { id: connectionId },
    select: {
      status: true,
      webhookAuthCiphertext: true,
    },
  })
  if (!connection || connection.status !== 'active' || !connection.webhookAuthCiphertext) {
    return NextResponse.json({ error: 'Webhook nao configurado.' }, { status: 404 })
  }

  const receivedToken = req.headers.get('asaas-access-token') || ''
  const expectedToken = decryptPaymentCredential(connection.webhookAuthCiphertext)
  if (!receivedToken || !secureTokenEqual(receivedToken, expectedToken)) {
    return NextResponse.json({ error: 'Webhook nao autorizado.' }, { status: 401 })
  }

  const payload = await req.json().catch(() => null) as AsaasWebhookPayload | null
  if (!payload?.id || !payload.event) {
    return NextResponse.json({ error: 'Evento invalido.' }, { status: 400 })
  }

  await persistAsaasWebhookEvent({ connectionId, payload })
  return NextResponse.json({ received: true })
}
