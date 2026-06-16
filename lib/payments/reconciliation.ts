import { prisma } from '@/lib/prisma'
import { getPaymentProviderForConnection } from './factory'
import { synchronizeExternalCharge } from './synchronize-charge'

function comparableLocal(charge: {
  status: string
  amount: { toString(): string }
  dueDate: Date
}) {
  return {
    status: charge.status,
    amount: Number(charge.amount).toFixed(2),
    dueDate: charge.dueDate.toISOString().slice(0, 10),
  }
}

function comparableProvider(charge: {
  status: string
  amount: string
  dueDate: string
}) {
  return {
    status: charge.status,
    amount: Number(charge.amount).toFixed(2),
    dueDate: charge.dueDate,
  }
}

export async function reconcilePaymentConnection(input: {
  connectionId: string
  trigger?: 'scheduled' | 'manual'
  limit?: number
}) {
  const run = await prisma.reconciliationRun.create({
    data: {
      connectionId: input.connectionId,
      trigger: input.trigger ?? 'scheduled',
    },
  })

  try {
    const { provider } = await getPaymentProviderForConnection(input.connectionId)
    const charges = await prisma.externalCharge.findMany({
      where: {
        connectionId: input.connectionId,
        status: { notIn: ['cancelled', 'refunded'] },
      },
      orderBy: { lastSynchronizedAt: 'asc' },
      take: input.limit ?? 500,
    })
    let divergences = 0
    let resolved = 0

    for (const local of charges) {
      try {
        const remote = await provider.getCharge(local.providerChargeId)
        await prisma.reconciliationDivergence.updateMany({
          where: {
            externalChargeId: local.id,
            status: 'pending',
          },
          data: {
            status: 'resolved',
            resolution: 'Consulta posterior ao provedor executada com sucesso.',
            resolvedAt: new Date(),
          },
        })
        const localValue = comparableLocal(local)
        const providerValue = comparableProvider(remote)
        if (JSON.stringify(localValue) !== JSON.stringify(providerValue)) {
          divergences += 1
          const divergence = await prisma.reconciliationDivergence.create({
            data: {
              reconciliationRunId: run.id,
              externalChargeId: local.id,
              type: 'charge_state_mismatch',
              localValue,
              providerValue,
            },
          })
          await prisma.$transaction(async (tx) => {
            await synchronizeExternalCharge({
              db: tx,
              externalChargeId: local.id,
              charge: remote,
              source: 'reconciliation',
              providerPayload: remote,
            })
            await tx.reconciliationDivergence.update({
              where: { id: divergence.id },
              data: {
                status: 'auto_resolved',
                resolution: 'Estado local atualizado a partir da consulta autenticada ao provedor.',
                resolvedAt: new Date(),
              },
            })
          })
          resolved += 1
        } else {
          await prisma.externalCharge.update({
            where: { id: local.id },
            data: { lastSynchronizedAt: new Date() },
          })
        }
      } catch (error) {
        divergences += 1
        await prisma.reconciliationDivergence.create({
          data: {
            reconciliationRunId: run.id,
            externalChargeId: local.id,
            type: 'provider_query_failed',
            localValue: comparableLocal(local),
            status: 'pending',
            resolution: error instanceof Error ? error.message : 'Erro desconhecido',
          },
        })
      }
    }

    return prisma.reconciliationRun.update({
      where: { id: run.id },
      data: {
        status: divergences === resolved ? 'completed' : 'completed_with_pending',
        checkedCount: charges.length,
        divergenceCount: divergences,
        resolvedCount: resolved,
        finishedAt: new Date(),
      },
      include: { divergences: true },
    })
  } catch (error) {
    await prisma.reconciliationRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Erro desconhecido',
        finishedAt: new Date(),
      },
    })
    throw error
  }
}

export async function reconcileAllActiveConnections() {
  const connections = await prisma.paymentProviderConnection.findMany({
    where: { status: 'active' },
    select: { id: true },
  })
  const results = []
  for (const connection of connections) {
    try {
      results.push(await reconcilePaymentConnection({ connectionId: connection.id }))
    } catch (error) {
      results.push({
        connectionId: connection.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      })
    }
  }
  return results
}
