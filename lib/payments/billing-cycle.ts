import type { Prisma, PrismaClient } from '@/app/generated/prisma'
import { prisma } from '@/lib/prisma'
import type { PaymentProvider } from './provider'
import type { BillingType } from './types'
import { createFinancialAuditLog } from './audit'
import { createHash } from 'crypto'

type ReceivableCandidate = {
  id: string
  kind?: string
  sequence: number
  dueDate: Date
  amount: { toString(): string }
}

type PaymentDatabase = PrismaClient | Prisma.TransactionClient

export function selectNextCycleReceivables<T extends ReceivableCandidate>(
  receivables: T[],
  cycleSize = 12,
) {
  if (!Number.isInteger(cycleSize) || cycleSize < 1 || cycleSize > 12) {
    throw new Error('O ciclo de cobranca deve conter entre 1 e 12 parcelas.')
  }

  return [...receivables]
    .sort((left, right) => left.sequence - right.sequence)
    .slice(0, cycleSize)
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) throw new Error('Data de vencimento invalida.')
  return new Date(Date.UTC(year, month - 1, day, 12))
}

function todayDateOnly() {
  return dateOnly(new Date())
}

export function assertChargeDueDateCanBeIssued(receivable: ReceivableCandidate, providerName: string, chargeDueDate?: Date) {
  if (providerName !== 'inter') return

  const dueDate = dateOnly(chargeDueDate ?? receivable.dueDate)
  if (dueDate < todayDateOnly()) {
    const label = receivable.kind === 'down_payment'
      ? 'entrada'
      : `parcela ${receivable.sequence}`
    throw new Error(`Nao e possivel emitir boleto pelo Inter para ${label} com vencimento em ${dueDate}. Atualize o vencimento para hoje ou uma data futura antes de gerar a cobranca.`)
  }
}

export function buildChargeExternalReference(receivableId: string, providerName: string, version = 1) {
  if (providerName === 'inter') {
    const value = version === 1 ? receivableId : `${receivableId}:v${version}`
    return `r${createHash('sha256').update(value).digest('hex').slice(0, 14)}`
  }
  return `receivable:${receivableId}:v${version}`
}

async function findOrCreateExternalCustomer(input: {
  db: PaymentDatabase
  connectionId: string
  provider: PaymentProvider
  user: {
    id: string
    name: string
    email: string
    cpf: string | null
    address?: string | null
    addressNumber?: string | null
    addressComplement?: string | null
    neighborhood?: string | null
    city?: string | null
    state?: string | null
    zipCode?: string | null
  }
}) {
  if (!input.user.cpf) throw new Error('O comprador precisa ter CPF ou CNPJ para emitir cobrancas.')

  const externalReference = `user:${input.user.id}`
  const customer = await input.provider.createCustomer({
    name: input.user.name,
    email: input.user.email,
    cpfCnpj: input.user.cpf,
    address: input.user.address,
    addressNumber: input.user.addressNumber,
    addressComplement: input.user.addressComplement,
    neighborhood: input.user.neighborhood,
    city: input.user.city,
    state: input.user.state,
    zipCode: input.user.zipCode,
    externalReference,
  })

  return input.db.externalCustomer.upsert({
    where: {
      connectionId_userId: {
        connectionId: input.connectionId,
        userId: input.user.id,
      },
    },
    create: {
      connectionId: input.connectionId,
      userId: input.user.id,
      providerCustomerId: customer.id,
      externalReference,
    },
    update: {
      providerCustomerId: customer.id,
      status: 'active',
      lastSynchronizedAt: new Date(),
    },
  })
}

async function findOrCreateCharge(input: {
  db: PaymentDatabase
  provider: PaymentProvider
  connectionId: string
  billingCycleId?: string | null
  providerCustomerId: string
  receivable: ReceivableCandidate
  saleId: string
  billingType: BillingType
  chargeDueDate?: Date
  interestPercentage?: string
  finePercentage?: string
}) {
  const externalReference = buildChargeExternalReference(input.receivable.id, input.provider.name)
  const saved = await input.db.externalCharge.findUnique({
    where: {
      connectionId_externalReference: {
        connectionId: input.connectionId,
        externalReference,
      },
    },
  })
  if (saved) return saved

  const listed = await input.provider.listCharges({ externalReference, limit: 1 })
  const receivableLabel = input.receivable.kind === 'down_payment'
    ? 'Entrada'
    : `Parcela ${input.receivable.sequence}`
  const charge = listed.charges[0] ?? await input.provider.createCharge({
    customerId: input.providerCustomerId,
    amount: input.receivable.amount.toString(),
    dueDate: dateOnly(input.chargeDueDate ?? input.receivable.dueDate),
    billingType: input.billingType,
    description: `${receivableLabel} da venda ${input.saleId}`,
    externalReference,
    interest: input.interestPercentage
      ? { percentage: input.interestPercentage }
      : undefined,
    fine: input.finePercentage
      ? { percentage: input.finePercentage }
      : undefined,
  })

  let pix: { payload: string; encodedImage: string } | null = null
  try {
    pix = await input.provider.getPixQrCode(charge.id)
  } catch {
    // A cobranca continua valida mesmo se o QR Code ainda nao estiver disponivel.
  }

  return input.db.externalCharge.upsert({
    where: {
      connectionId_externalReference: {
        connectionId: input.connectionId,
        externalReference,
      },
    },
    create: {
      connectionId: input.connectionId,
      billingCycleId: input.billingCycleId ?? null,
      receivableId: input.receivable.id,
      providerChargeId: charge.id,
      externalReference,
      billingType: input.billingType,
      status: charge.status,
      amount: input.receivable.amount.toString(),
      dueDate: input.chargeDueDate ?? input.receivable.dueDate,
      invoiceUrl: charge.invoiceUrl,
      bankSlipUrl: charge.bankSlipUrl,
      pixPayload: pix?.payload,
      pixEncodedImage: pix?.encodedImage,
      providerPayload: JSON.parse(JSON.stringify(charge)) as Prisma.InputJsonValue,
    },
    update: {
      billingCycleId: input.billingCycleId ?? undefined,
      status: charge.status,
      invoiceUrl: charge.invoiceUrl,
      bankSlipUrl: charge.bankSlipUrl,
      pixPayload: pix?.payload,
      pixEncodedImage: pix?.encodedImage,
      lastSynchronizedAt: new Date(),
    },
  })
}

export async function issueNextBillingCycle(input: {
  connectionId: string
  saleId: string
  provider: PaymentProvider
  cycleSize?: number
  billingType?: BillingType
  interestPercentage?: string
  finePercentage?: string
  db?: PaymentDatabase
  actorId?: string | null
}) {
  const db = input.db ?? prisma
  const cycleSize = input.cycleSize ?? 12
  const billingType = input.billingType ?? 'BOLETO'

  const connection = await db.paymentProviderConnection.findUnique({
    where: { id: input.connectionId },
  })
  if (!connection || connection.status !== 'active') {
    throw new Error('A conexao com o provedor de pagamentos nao esta ativa.')
  }
  if (connection.provider !== input.provider.name) {
    throw new Error('O provedor informado nao corresponde a conexao selecionada.')
  }

  const sale = await db.sale.findUnique({
    where: { id: input.saleId },
    include: {
      user: true,
      lot: {
        include: {
          block: {
            include: { development: true },
          },
        },
      },
      billingCycles: {
        where: { connectionId: input.connectionId, cycleNumber: { gt: 0 } },
        orderBy: { cycleNumber: 'desc' },
        take: 1,
      },
      receivables: {
        where: {
          kind: 'installment',
          status: { not: 'paid' },
        },
        orderBy: { sequence: 'asc' },
        include: {
          externalCharges: {
            where: { connectionId: input.connectionId },
          },
        },
      },
    },
  })
  if (!sale) throw new Error('Venda nao encontrada.')
  if (sale.lot.block.development?.companyId !== connection.companyId) {
    throw new Error('A conexao de pagamento pertence a outra empresa.')
  }

  const previousCycle = sale.billingCycles[0]
  const retryingCycle = previousCycle && ['issuing', 'failed'].includes(previousCycle.status)
    ? previousCycle
    : null
  const cycleReceivables = retryingCycle
    ? sale.receivables.filter(
        (receivable) =>
          receivable.sequence >= retryingCycle.startSequence &&
          receivable.sequence <= retryingCycle.endSequence,
      )
    : selectNextCycleReceivables(
        sale.receivables.filter((receivable) => receivable.externalCharges.length === 0),
        cycleSize,
      )

  if (cycleReceivables.length === 0) {
    return { cycle: null, charges: [], alreadyComplete: true }
  }
  cycleReceivables
    .filter((receivable) => receivable.externalCharges.length === 0)
    .forEach((receivable) => assertChargeDueDateCanBeIssued(receivable, input.provider.name))

  const nextCycleNumber = retryingCycle?.cycleNumber ?? (previousCycle?.cycleNumber ?? 0) + 1
  const adjustmentReview = sale.annualAdjustment && nextCycleNumber > 1
    ? await db.adjustmentReview.findUnique({
        where: {
          connectionId_saleId_cycleNumber: {
            connectionId: connection.id,
            saleId: sale.id,
            cycleNumber: nextCycleNumber,
          },
        },
      })
    : null
  if (sale.annualAdjustment && nextCycleNumber > 1 && adjustmentReview?.status !== 'applied') {
    throw new Error('O reajuste anual precisa ser aprovado e aplicado antes do proximo ciclo.')
  }

  const cycle = retryingCycle
    ? await db.billingCycle.update({
        where: { id: retryingCycle.id },
        data: { status: 'issuing' },
      })
    : await db.billingCycle.create({
        data: {
          connectionId: connection.id,
          saleId: sale.id,
          cycleNumber: (previousCycle?.cycleNumber ?? 0) + 1,
          startSequence: cycleReceivables[0].sequence,
          endSequence: cycleReceivables[cycleReceivables.length - 1].sequence,
          status: 'issuing',
          adjustmentReviewId: adjustmentReview?.id,
        },
      })
  const customer = await findOrCreateExternalCustomer({
    db,
    connectionId: connection.id,
    provider: input.provider,
    user: sale.user,
  })

  const charges = cycleReceivables.flatMap((receivable) => receivable.externalCharges)
  try {
    for (const receivable of cycleReceivables.filter(
      (candidate) => candidate.externalCharges.length === 0,
    )) {
      charges.push(await findOrCreateCharge({
        db,
        provider: input.provider,
        connectionId: connection.id,
        billingCycleId: cycle.id,
        providerCustomerId: customer.providerCustomerId,
        receivable,
        saleId: sale.id,
        billingType,
        interestPercentage: input.interestPercentage,
        finePercentage: input.finePercentage,
      }))
    }
  } catch (error) {
    await db.billingCycle.update({
      where: { id: cycle.id },
      data: { status: 'failed' },
    })
    throw error
  }

  const issuedCycle = await db.billingCycle.update({
    where: { id: cycle.id },
    data: {
      status: 'issued',
      issuedAt: new Date(),
    },
  })

  await createFinancialAuditLog(db, {
    companyId: connection.companyId,
    actorId: input.actorId,
    action: 'billing_cycle_issued',
    entityType: 'billing_cycle',
    entityId: issuedCycle.id,
    saleId: sale.id,
    metadata: {
      cycleNumber: issuedCycle.cycleNumber,
      startSequence: issuedCycle.startSequence,
      endSequence: issuedCycle.endSequence,
      charges: charges.length,
      provider: connection.provider,
      environment: connection.environment,
    },
  })

  return { cycle: issuedCycle, charges, alreadyComplete: false }
}

export async function issueReceivableCharge(input: {
  connectionId: string
  receivableId: string
  provider: PaymentProvider
  billingType?: BillingType
  chargeDueDate?: string
  interestPercentage?: string
  finePercentage?: string
  db?: PaymentDatabase
  actorId?: string | null
}) {
  const db = input.db ?? prisma
  const billingType = input.billingType ?? 'BOLETO'

  const connection = await db.paymentProviderConnection.findUnique({
    where: { id: input.connectionId },
  })
  if (!connection || connection.status !== 'active') {
    throw new Error('A conexao com o provedor de pagamentos nao esta ativa.')
  }
  if (connection.provider !== input.provider.name) {
    throw new Error('O provedor informado nao corresponde a conexao selecionada.')
  }

  const receivable = await db.receivable.findUnique({
    where: { id: input.receivableId },
    include: {
      externalCharges: {
        where: { connectionId: input.connectionId },
      },
      sale: {
        include: {
          user: true,
          lot: {
            include: {
              block: {
                include: { development: true },
              },
            },
          },
        },
      },
    },
  })
  if (!receivable) throw new Error('Recebivel nao encontrado.')
  if (receivable.sale.lot.block.development?.companyId !== connection.companyId) {
    throw new Error('A conexao de pagamento pertence a outra empresa.')
  }
  if (receivable.status === 'paid') {
    throw new Error('Nao e possivel emitir boleto para um recebivel pago.')
  }

  const existing = receivable.externalCharges.find((charge) => !['cancelled', 'refunded'].includes(charge.status))
  if (existing) return { charge: existing, alreadyComplete: true }
  const chargeDueDate = input.chargeDueDate ? parseDateOnly(input.chargeDueDate) : undefined
  assertChargeDueDateCanBeIssued(receivable, input.provider.name, chargeDueDate)

  const customer = await findOrCreateExternalCustomer({
    db,
    connectionId: connection.id,
    provider: input.provider,
    user: receivable.sale.user,
  })
  const charge = await findOrCreateCharge({
    db,
    provider: input.provider,
    connectionId: connection.id,
    billingCycleId: null,
    providerCustomerId: customer.providerCustomerId,
    receivable,
    saleId: receivable.saleId,
    billingType,
    chargeDueDate,
    interestPercentage: input.interestPercentage,
    finePercentage: input.finePercentage,
  })

  await createFinancialAuditLog(db, {
    companyId: connection.companyId,
    actorId: input.actorId,
    action: 'receivable_charge_issued',
    entityType: 'external_charge',
    entityId: charge.id,
    saleId: receivable.saleId,
    receivableId: receivable.id,
    externalChargeId: charge.id,
    metadata: {
      kind: receivable.kind,
      sequence: receivable.sequence,
      provider: connection.provider,
      environment: connection.environment,
    },
  })

  return { charge, alreadyComplete: false }
}
