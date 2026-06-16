import { Prisma, type PrismaClient } from '@/app/generated/prisma'
import { prisma } from '@/lib/prisma'
import { mapAsaasPayment, type AsaasPayment } from './asaas-provider'
import { synchronizeExternalCharge } from './synchronize-charge'
import type { PaymentCharge, PaymentChargeStatus } from './types'

export type AsaasWebhookPayload = {
  id: string
  event: string
  dateCreated?: string
  payment?: AsaasPayment
}

function eventStatus(eventType: string): PaymentChargeStatus | null {
  switch (eventType) {
    case 'PAYMENT_CONFIRMED': return 'confirmed'
    case 'PAYMENT_RECEIVED': return 'received'
    case 'PAYMENT_OVERDUE':
    case 'PAYMENT_BANK_SLIP_CANCELLED': return 'overdue'
    case 'PAYMENT_DELETED': return 'cancelled'
    case 'PAYMENT_RESTORED':
    case 'PAYMENT_CREATED':
    case 'PAYMENT_UPDATED': return 'pending'
    case 'PAYMENT_REFUNDED':
    case 'PAYMENT_PARTIALLY_REFUNDED':
    case 'PAYMENT_REFUND_IN_PROGRESS':
    case 'PAYMENT_RECEIVED_IN_CASH_UNDONE': return 'refunded'
    default: return null
  }
}

export function mapAsaasWebhookCharge(payload: AsaasWebhookPayload): PaymentCharge | null {
  if (!payload.payment) return null
  const charge = mapAsaasPayment(payload.payment)
  const status = eventStatus(payload.event)
  return status ? { ...charge, status, deleted: status === 'cancelled' } : charge
}

function parseEventDate(value?: string) {
  if (!value) return null
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function persistAsaasWebhookEvent(input: {
  connectionId: string
  payload: AsaasWebhookPayload
}) {
  try {
    const event = await prisma.paymentWebhookEvent.create({
      data: {
        connectionId: input.connectionId,
        providerEventId: input.payload.id,
        eventType: input.payload.event,
        payload: JSON.parse(JSON.stringify(input.payload)) as Prisma.InputJsonValue,
      },
    })
    await prisma.paymentProviderConnection.update({
      where: { id: input.connectionId },
      data: {
        lastWebhookAt: new Date(),
        webhookStatus: 'active',
      },
    })
    return { event, duplicate: false }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const event = await prisma.paymentWebhookEvent.findUniqueOrThrow({
        where: {
          connectionId_providerEventId: {
            connectionId: input.connectionId,
            providerEventId: input.payload.id,
          },
        },
      })
      return { event, duplicate: true }
    }
    throw error
  }
}

async function processEvent(db: PrismaClient, eventId: string) {
  const event = await db.paymentWebhookEvent.findUniqueOrThrow({ where: { id: eventId } })
  const payload = event.payload as unknown as AsaasWebhookPayload
  const charge = mapAsaasWebhookCharge(payload)
  if (!charge || !payload.payment?.id) {
    await db.paymentWebhookEvent.update({
      where: { id: event.id },
      data: { status: 'ignored', processedAt: new Date(), errorMessage: null },
    })
    return 'ignored'
  }

  const externalCharge = await db.externalCharge.findFirst({
    where: {
      connectionId: event.connectionId,
      OR: [
        { providerChargeId: payload.payment.id },
        ...(payload.payment.externalReference
          ? [{ externalReference: payload.payment.externalReference }]
          : []),
      ],
    },
    select: { id: true },
  })
  if (!externalCharge) {
    await db.paymentWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: 'ignored',
        processedAt: new Date(),
        errorMessage: 'Cobranca nao pertence a Lotiva.',
      },
    })
    return 'ignored'
  }

  await db.$transaction(async (tx) => {
    await synchronizeExternalCharge({
      db: tx,
      externalChargeId: externalCharge.id,
      charge,
      source: 'webhook',
      eventAt: parseEventDate(payload.dateCreated),
      providerPayload: payload.payment,
    })
    await tx.paymentWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: 'processed',
        processedAt: new Date(),
        errorMessage: null,
        nextAttemptAt: null,
      },
    })
  })
  return 'processed'
}

export async function processPendingWebhookEvents(options: {
  limit?: number
  db?: PrismaClient
} = {}) {
  const db = options.db ?? prisma
  const now = new Date()
  const events = await db.paymentWebhookEvent.findMany({
    where: {
      status: { in: ['pending', 'failed'] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { createdAt: 'asc' },
    take: options.limit ?? 100,
  })
  const result = { processed: 0, ignored: 0, failed: 0 }

  for (const event of events) {
    try {
      const status = await processEvent(db, event.id)
      result[status] += 1
    } catch (error) {
      const attempts = event.attempts + 1
      const delayMinutes = Math.min(2 ** attempts, 60)
      await db.paymentWebhookEvent.update({
        where: { id: event.id },
        data: {
          status: 'failed',
          attempts,
          errorMessage: error instanceof Error ? error.message : 'Erro desconhecido',
          nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000),
        },
      })
      result.failed += 1
    }
  }

  return result
}
