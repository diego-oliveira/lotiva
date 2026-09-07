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
    if (!['asaas', 'inter'].includes(data.provider)) {
      return NextResponse.json({ error: 'Selecione uma conta de pagamento configurada.' }, { status: 400 })
    }
    const providerName = data.provider as 'asaas' | 'inter'
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
              provider: providerName,
              environment: requestedEnvironment,
            },
          },
        })
      : await prisma.paymentProviderConnection.findFirst({
          where: {
            companyId,
            provider: providerName,
            status: 'active',
            environment: 'production',
          },
        }) || await prisma.paymentProviderConnection.findFirst({
          where: {
            companyId,
            provider: providerName,
            status: 'active',
            environment: 'sandbox',
          },
        })
    if (!connection || connection.status !== 'active') {
      return NextResponse.json(
        { error: `A empresa ainda nao possui uma conta ${providerName === 'inter' ? 'Banco Inter' : 'Asaas'} configurada.` },
        { status: 409 },
      )
    }

    try {
      const payment = await getPaymentProviderForConnection(connection.id)
      const result = await issueReceivableCharge({
        connectionId: connection.id,
        receivableId: id,
        provider: payment.provider,
        billingType: data.billingType === 'PIX' ? 'PIX' : 'BOLETO',
        chargeDueDate: typeof data.chargeDueDate === 'string' ? data.chargeDueDate : undefined,
        interestPercentage: data.interestPercentage
          ? String(data.interestPercentage)
          : undefined,
        finePercentage: data.finePercentage
          ? String(data.finePercentage)
          : undefined,
        actorId: currentUserId,
      })

      return NextResponse.json(result, { status: result.alreadyComplete ? 200 : 201 })
    } catch (issueError) {
      console.error('payment_charge_issue_failed', {
        provider: providerName,
        environment: connection.environment,
        companyId,
        receivableId: id,
        connectionId: connection.id,
        error: issueError instanceof Error ? issueError.message : String(issueError),
      })
      throw issueError
    }
  } catch (error) {
    return NextResponse.json({
      error: 'Nao foi possivel emitir o boleto.',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    }, { status: 400 })
  }
}
