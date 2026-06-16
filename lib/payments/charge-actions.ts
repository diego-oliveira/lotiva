import { Prisma } from '@/app/generated/prisma'
import { prisma } from '@/lib/prisma'
import { getPaymentProviderForConnection } from './factory'
import { synchronizeExternalCharge } from './synchronize-charge'
import { createFinancialAuditLog } from './audit'

async function getChargeContext(externalChargeId: string) {
  const charge = await prisma.externalCharge.findUnique({
    where: { id: externalChargeId },
    include: {
      connection: true,
      receivable: {
        include: {
          sale: {
            include: {
              user: true,
              lot: { include: { block: { include: { development: true } } } },
            },
          },
          externalCharges: { orderBy: { version: 'desc' } },
        },
      },
    },
  })
  if (!charge) throw new Error('Cobranca externa nao encontrada.')
  return charge
}

export async function cancelExternalCharge(input: {
  externalChargeId: string
  actorId: string
  reason: string
}) {
  if (!input.reason.trim()) throw new Error('Informe o motivo do cancelamento.')
  const saved = await getChargeContext(input.externalChargeId)
  if (['confirmed', 'received'].includes(saved.status) || saved.receivable.status === 'paid') {
    throw new Error('Uma cobranca paga ou confirmada nao pode ser cancelada.')
  }
  if (saved.status === 'cancelled') return saved

  const { provider } = await getPaymentProviderForConnection(saved.connectionId)
  const cancelled = await provider.cancelCharge(saved.providerChargeId)
  return prisma.$transaction(async (tx) => {
    await synchronizeExternalCharge({
      db: tx,
      externalChargeId: saved.id,
      charge: { ...cancelled, status: 'cancelled' },
      source: 'manual',
      eventAt: new Date(),
      actorId: input.actorId,
      providerPayload: cancelled,
    })
    const updated = await tx.externalCharge.update({
      where: { id: saved.id },
      data: {
        cancellationReason: input.reason.trim(),
        cancelledById: input.actorId,
        cancelledAt: new Date(),
      },
    })
    await createFinancialAuditLog(tx, {
      companyId: saved.connection.companyId,
      actorId: input.actorId,
      action: 'external_charge_cancelled',
      entityType: 'external_charge',
      entityId: saved.id,
      saleId: saved.receivable.saleId,
      receivableId: saved.receivableId,
      externalChargeId: saved.id,
      metadata: { reason: input.reason.trim(), providerChargeId: saved.providerChargeId },
    })
    return updated
  })
}

export async function reissueExternalCharge(input: {
  externalChargeId: string
  actorId: string
  reason: string
}) {
  let saved = await getChargeContext(input.externalChargeId)
  if (!['cancelled', 'refunded'].includes(saved.status)) {
    await cancelExternalCharge(input)
    saved = await getChargeContext(input.externalChargeId)
  }
  if (saved.receivable.status === 'paid') {
    throw new Error('Uma parcela paga nao pode ser reemitida.')
  }

  const { provider } = await getPaymentProviderForConnection(saved.connectionId)
  const customer = await prisma.externalCustomer.findUnique({
    where: {
      connectionId_userId: {
        connectionId: saved.connectionId,
        userId: saved.receivable.sale.userId,
      },
    },
  })
  if (!customer) throw new Error('Cliente externo nao encontrado para reemissao.')

  const version = Math.max(
    ...saved.receivable.externalCharges
      .filter((charge) => charge.connectionId === saved.connectionId)
      .map((charge) => charge.version),
    0,
  ) + 1
  const externalReference = `receivable:${saved.receivableId}:v${version}`
  const providerCharge = await provider.createCharge({
    customerId: customer.providerCustomerId,
    amount: saved.receivable.amount.toString(),
    dueDate: saved.receivable.dueDate.toISOString().slice(0, 10),
    billingType: saved.billingType === 'PIX' ? 'PIX' : 'BOLETO',
    description: `Parcela ${saved.receivable.sequence} da venda ${saved.receivable.saleId}`,
    externalReference,
  })
  let pix: { payload: string; encodedImage: string } | null = null
  try {
    pix = await provider.getPixQrCode(providerCharge.id)
  } catch {
    // O boleto permanece valido mesmo quando o QR Code ainda nao foi gerado.
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.externalCharge.create({
      data: {
        connectionId: saved.connectionId,
        billingCycleId: saved.billingCycleId,
        receivableId: saved.receivableId,
        providerChargeId: providerCharge.id,
        externalReference,
        version,
        billingType: providerCharge.billingType,
        status: providerCharge.status,
        amount: providerCharge.amount,
        dueDate: new Date(`${providerCharge.dueDate}T12:00:00`),
        invoiceUrl: providerCharge.invoiceUrl,
        bankSlipUrl: providerCharge.bankSlipUrl,
        pixPayload: pix?.payload,
        pixEncodedImage: pix?.encodedImage,
        providerPayload: JSON.parse(JSON.stringify(providerCharge)) as Prisma.InputJsonValue,
      },
    })
    await createFinancialAuditLog(tx, {
      companyId: saved.connection.companyId,
      actorId: input.actorId,
      action: 'external_charge_reissued',
      entityType: 'external_charge',
      entityId: created.id,
      saleId: saved.receivable.saleId,
      receivableId: saved.receivableId,
      externalChargeId: created.id,
      metadata: {
        previousExternalChargeId: saved.id,
        providerChargeId: created.providerChargeId,
        version,
        reason: input.reason.trim(),
      },
    })
    return created
  })
}
