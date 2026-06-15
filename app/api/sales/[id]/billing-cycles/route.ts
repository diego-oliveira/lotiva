import { forbiddenResponse, saleAccessWhere } from '@/lib/access-control'
import { requireAuthenticatedUser } from '@/lib/auth'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { issueNextBillingCycle } from '@/lib/payments/billing-cycle'
import { getPaymentProviderForConnection } from '@/lib/payments/factory'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
type Params = { params: Promise<{ id: string }> }

async function getAuthorizedSale(userId: string, saleId: string) {
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
  if (!sale || !developmentId || !(await hasDevelopmentPermission(userId, developmentId, 'finance'))) {
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
          billingType: true,
          status: true,
          amount: true,
          dueDate: true,
          invoiceUrl: true,
          bankSlipUrl: true,
          pixPayload: true,
          cancelledAt: true,
          lastSynchronizedAt: true,
        },
      },
    },
    orderBy: { cycleNumber: 'desc' },
  })

  return NextResponse.json(cycles)
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const { id } = await params
  const authorized = await getAuthorizedSale(auth.session.user.id, id)
  if (!authorized?.companyId) return forbiddenResponse()

  try {
    const data = await req.json().catch(() => ({}))
    const environment = data.environment === 'production' ? 'production' : 'sandbox'
    const connection = await prisma.paymentProviderConnection.findUnique({
      where: {
        companyId_provider_environment: {
          companyId: authorized.companyId,
          provider: 'asaas',
          environment,
        },
      },
    })
    if (!connection) {
      return NextResponse.json(
        { error: `A empresa nao possui uma conexao Asaas ${environment} configurada.` },
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
    })

    return NextResponse.json(result, { status: result.alreadyComplete ? 200 : 201 })
  } catch (error) {
    return NextResponse.json({
      error: 'Nao foi possivel emitir o ciclo de cobrancas.',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    }, { status: 400 })
  }
}
