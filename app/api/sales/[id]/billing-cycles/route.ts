import { forbiddenResponse, saleAccessWhere } from '@/lib/access-control'
import { requireAuthenticatedUser } from '@/lib/auth'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { issueNextBillingCycle } from '@/lib/payments/billing-cycle'
import { getPaymentProviderForConnection } from '@/lib/payments/factory'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
type Params = { params: Promise<{ id: string }> }

async function getAuthorizedSale(
  userId: string,
  saleId: string,
  permission: 'finance' | 'issuePayments' = 'finance',
) {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, ...saleAccessWhere(userId) },
    select: {
      id: true,
      lot: {
        select: {
          block: {
            select: {
              developmentId: true,
              development: { select: { companyId: true } },
            },
          },
        },
      },
    },
  })
  const developmentId = sale?.lot.block.developmentId
  if (!sale || !developmentId || !(await hasDevelopmentPermission(userId, developmentId, permission))) {
    return null
  }
  return {
    sale,
    developmentId,
    companyId: sale.lot.block.development?.companyId,
  }
}

export async function GET(_: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const { id } = await params
  const authorized = await getAuthorizedSale(auth.session.user.id, id)
  if (!authorized) return forbiddenResponse()

  const cycles = await prisma.billingCycle.findMany({
    where: { saleId: id },
    include: {
      connection: {
        select: {
          provider: true,
          environment: true,
          status: true,
        },
      },
      externalCharges: {
        orderBy: { dueDate: 'asc' },
        select: {
          id: true,
          receivableId: true,
          providerChargeId: true,
          version: true,
          billingType: true,
          status: true,
          amount: true,
          dueDate: true,
          invoiceUrl: true,
          bankSlipUrl: true,
          pixPayload: true,
          cancelledAt: true,
          cancellationReason: true,
          grossPaidAmount: true,
          netPaidAmount: true,
          feeAmount: true,
          providerPaymentDate: true,
          lastSynchronizedAt: true,
        },
      },
    },
    orderBy: { cycleNumber: 'desc' },
  })

  const standaloneCharges = await prisma.externalCharge.findMany({
    where: {
      billingCycleId: null,
      receivable: { saleId: id },
    },
    orderBy: { dueDate: 'asc' },
    select: {
      id: true,
      receivableId: true,
      providerChargeId: true,
      version: true,
      billingType: true,
      status: true,
      amount: true,
      dueDate: true,
      invoiceUrl: true,
      bankSlipUrl: true,
      pixPayload: true,
      cancelledAt: true,
      cancellationReason: true,
      grossPaidAmount: true,
      netPaidAmount: true,
      feeAmount: true,
      providerPaymentDate: true,
      lastSynchronizedAt: true,
      connection: {
        select: {
          provider: true,
          environment: true,
          status: true,
        },
      },
    },
  })

  if (standaloneCharges.length === 0) return NextResponse.json(cycles)

  return NextResponse.json([
    ...cycles,
    {
      id: 'standalone',
      cycleNumber: 0,
      startSequence: 0,
      endSequence: 0,
      status: 'issued',
      issuedAt: standaloneCharges[0].lastSynchronizedAt,
      connection: standaloneCharges[0].connection,
      externalCharges: standaloneCharges.map(({ connection: _connection, ...charge }) => charge),
    },
  ])
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const { id } = await params
  const authorized = await getAuthorizedSale(auth.session.user.id, id, 'issuePayments')
  if (!authorized?.companyId) return forbiddenResponse()

  try {
    const data = await req.json().catch(() => ({}))
    const requestedEnvironment = data.environment === 'production'
      ? 'production'
      : data.environment === 'sandbox'
        ? 'sandbox'
        : null
    const connection = requestedEnvironment
      ? await prisma.paymentProviderConnection.findUnique({
          where: {
            companyId_provider_environment: {
              companyId: authorized.companyId,
              provider: 'asaas',
              environment: requestedEnvironment,
            },
          },
        })
      : await prisma.paymentProviderConnection.findFirst({
          where: {
            companyId: authorized.companyId,
            provider: 'asaas',
            status: 'active',
            environment: 'production',
          },
        }) || await prisma.paymentProviderConnection.findFirst({
          where: {
            companyId: authorized.companyId,
            provider: 'asaas',
            status: 'active',
            environment: 'sandbox',
          },
        })
    if (!connection || connection.status !== 'active') {
      return NextResponse.json(
        { error: 'A empresa ainda nao possui uma conta Asaas configurada.' },
        { status: 409 },
      )
    }

    const payment = await getPaymentProviderForConnection(connection.id)
    const result = await issueNextBillingCycle({
      connectionId: connection.id,
      saleId: id,
      provider: payment.provider,
      cycleSize: data.cycleSize === undefined ? 12 : Number(data.cycleSize),
      billingType: data.billingType === 'PIX' ? 'PIX' : 'BOLETO',
      interestPercentage: data.interestPercentage
        ? String(data.interestPercentage)
        : undefined,
      finePercentage: data.finePercentage
        ? String(data.finePercentage)
        : undefined,
      actorId: auth.session.user.id,
    })

    return NextResponse.json(result, { status: result.alreadyComplete ? 200 : 201 })
  } catch (error) {
    return NextResponse.json({
      error: 'Nao foi possivel emitir o ciclo de cobrancas.',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    }, { status: 400 })
  }
}
