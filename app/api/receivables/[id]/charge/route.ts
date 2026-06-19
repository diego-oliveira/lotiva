import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, receivableAccessWhere } from '@/lib/access-control'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { issueReceivableCharge } from '@/lib/payments/billing-cycle'
import { getPaymentProviderForConnection } from '@/lib/payments/factory'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id
  const { id } = await params

  const receivable = await prisma.receivable.findFirst({
    where: {
      id,
      ...receivableAccessWhere(currentUserId),
    },
    select: {
      id: true,
      sale: {
        select: {
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
      },
    },
  })

  const developmentId = receivable?.sale.lot.block.developmentId
  const companyId = receivable?.sale.lot.block.development?.companyId
  if (!developmentId || !companyId || !(await hasDevelopmentPermission(currentUserId, developmentId, 'issuePayments'))) {
    return forbiddenResponse()
  }

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
              companyId,
              provider: 'asaas',
              environment: requestedEnvironment,
            },
          },
        })
      : await prisma.paymentProviderConnection.findFirst({
          where: {
            companyId,
            provider: 'asaas',
            status: 'active',
            environment: 'production',
          },
        }) || await prisma.paymentProviderConnection.findFirst({
          where: {
            companyId,
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
    const result = await issueReceivableCharge({
      connectionId: connection.id,
      receivableId: id,
      provider: payment.provider,
      billingType: data.billingType === 'PIX' ? 'PIX' : 'BOLETO',
      interestPercentage: data.interestPercentage
        ? String(data.interestPercentage)
        : undefined,
      finePercentage: data.finePercentage
        ? String(data.finePercentage)
        : undefined,
      actorId: currentUserId,
    })

    return NextResponse.json(result, { status: result.alreadyComplete ? 200 : 201 })
  } catch (error) {
    return NextResponse.json({
      error: 'Nao foi possivel emitir o boleto.',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    }, { status: 400 })
  }
}
