import type { Prisma, PrismaClient } from '@/app/generated/prisma'
import { prisma } from '@/lib/prisma'
import type { PaymentProvider } from './provider'
import type { BillingType } from './types'

type ReceivableCandidate = {
  id: string
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

async function findOrCreateExternalCustomer(input: {
  db: PaymentDatabase
  connectionId: string
  provider: PaymentProvider
  user: {
    id: string
    name: string
    email: string
    cpf: string | null
  }
}) {
  const saved = await input.db.externalCustomer.findUnique({
    where: {
      connectionId_userId: {
        connectionId: input.connectionId,
        userId: input.user.id,
      },
    },
  })
  if (saved) return saved
  if (!input.user.cpf) throw new Error('O comprador precisa ter CPF ou CNPJ para emitir cobrancas.')

  const externalReference = `user:${input.user.id}`
  const customer = await input.provider.findCustomerByDocument(input.user.cpf)
    ?? await input.provider.createCustomer({
      name: input.user.name,
      email: input.user.email,
      cpfCnpj: input.user.cpf,
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
  billingCycleId: string
  providerCustomerId: string
  receivable: ReceivableCandidate
  saleId: string
  billingType: BillingType
  interestPercentage?: string
  finePercentage?: string
}) {
  const externalReference = `receivable:${input.receivable.id}:v1`
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
  const charge = listed.charges[0] ?? await input.provider.createCharge({
    customerId: input.providerCustomerId,
    amount: input.receivable.amount.toString(),
    dueDate: dateOnly(input.receivable.dueDate),
    billingType: input.billingType,
    description: `Parcela ${input.receivable.sequence} da venda ${input.saleId}`,
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
      billingCycleId: input.billingCycleId,
      receivableId: input.receivable.id,
      providerChargeId: charge.id,
      externalReference,
      billingType: input.billingType,
      status: charge.status,
      amount: input.receivable.amount.toString(),
      dueDate: input.receivable.dueDate,
      invoiceUrl: charge.invoiceUrl,
      bankSlipUrl: charge.bankSlipUrl,
      pixPayload: pix?.payload,
      pixEncodedImage: pix?.encodedImage,
      providerPayload: JSON.parse(JSON.stringify(charge)) as Prisma.InputJsonValue,
    },
    update: {
      billingCycleId: input.billingCycleId,
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
        where: { connectionId: input.connectionId },
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

  return { cycle: issuedCycle, charges, alreadyComplete: false }
}
