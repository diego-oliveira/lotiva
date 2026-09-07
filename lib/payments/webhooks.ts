import { Prisma, type PrismaClient } from '@/app/generated/prisma'
import { prisma } from '@/lib/prisma'
import { mapAsaasPayment, type AsaasPayment } from './asaas-provider'
import { mapInterCharge, type InterCharge } from './inter-provider'
import { synchronizeExternalCharge } from './synchronize-charge'
import type { PaymentCharge, PaymentChargeStatus } from './types'

export type AsaasWebhookPayload = {
  id: string
  event: string
  dateCreated?: string
  payment?: AsaasPayment
}

export type InterWebhookItem = InterCharge & {
  dataHoraSituacao?: string
  nossoNumero?: string
  codigoBarras?: string
  linhaDigitavel?: string
  txid?: string
  pixCopiaECola?: string
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

export function mapInterWebhookCharge(payload: InterWebhookItem): PaymentCharge | null {
  if (!payload.codigoSolicitacao) return null
  return mapInterCharge({
    codigoSolicitacao: payload.codigoSolicitacao,
    seuNumero: payload.seuNumero,
    situacao: payload.situacao,
    valorNominal: payload.valorNominal,
    valorTotalRecebido: payload.valorTotalRecebido,
    origemRecebimento: payload.origemRecebimento,
    linhaDigitavel: payload.linhaDigitavel,
    pixCopiaECola: payload.pixCopiaECola,
  })
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

export async function persistInterWebhookEvents(input: {
  connectionId: string
  payload: InterWebhookItem[]
}) {
  const result = { created: 0, duplicates: 0 }
  for (const item of input.payload) {
    try {
      await prisma.paymentWebhookEvent.create({
        data: {
          connectionId: input.connectionId,
          providerEventId: `${item.codigoSolicitacao}:${item.situacao}:${item.dataHoraSituacao || ''}`,
          eventType: item.situacao || 'UNKNOWN',
          payload: JSON.parse(JSON.stringify(item)) as Prisma.InputJsonValue,
        },
      })
      result.created += 1
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        result.duplicates += 1
        continue
      }
      throw error
    }
  }
  await prisma.paymentProviderConnection.update({
    where: { id: input.connectionId },
    data: {
      lastWebhookAt: new Date(),
      webhookStatus: 'active',
    },
  })
  return result
}

async function processEvent(db: PrismaClient, eventId: string) {
  const event = await db.paymentWebhookEvent.findUniqueOrThrow({
    where: { id: eventId },
    include: { connection: { select: { provider: true } } },
  })
  const payload = event.payload as unknown
  const asaasPayload = payload as AsaasWebhookPayload
  const interPayload = payload as InterWebhookItem
  const charge = event.connection.provider === 'inter'
    ? mapInterWebhookCharge(interPayload)
    : mapAsaasWebhookCharge(asaasPayload)
  const providerChargeId = event.connection.provider === 'inter'
    ? interPayload.codigoSolicitacao
    : asaasPayload.payment?.id
  const externalReference = event.connection.provider === 'inter'
    ? interPayload.seuNumero
    : asaasPayload.payment?.externalReference
  if (!charge || !providerChargeId) {
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
        { providerChargeId },
        ...(externalReference
          ? [{ externalReference }]
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
      eventAt: parseEventDate(
        event.connection.provider === 'inter'
          ? interPayload.dataHoraSituacao
          : asaasPayload.dateCreated,
      ),
      providerPayload: event.connection.provider === 'inter' ? interPayload : asaasPayload.payment,
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
