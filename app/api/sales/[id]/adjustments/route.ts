import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, saleAccessWhere } from '@/lib/access-control'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { createAdjustmentReview } from '@/lib/payments/adjustments'

type Params = { params: Promise<{ id: string }> }

async function authorize(userId: string, saleId: string) {
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
  return { developmentId, companyId: sale.lot.block.development?.companyId }
}

export async function GET(_: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const { id } = await params
  if (!(await authorize(auth.session.user.id, id))) return forbiddenResponse()

  return NextResponse.json(await prisma.adjustmentReview.findMany({
    where: { saleId: id },
    include: {
      connection: { select: { environment: true, provider: true } },
      createdBy: { select: { name: true } },
      reviewedBy: { select: { name: true } },
      items: {
        include: { receivable: { select: { sequence: true, dueDate: true } } },
        orderBy: { receivable: { sequence: 'asc' } },
      },
    },
    orderBy: { cycleNumber: 'desc' },
  }))
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const { id } = await params
  const authorized = await authorize(auth.session.user.id, id)
  if (!authorized?.companyId) return forbiddenResponse()

  try {
    const data = await req.json()
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
    if (!connection || connection.status !== 'active') {
      return NextResponse.json({ error: `Conexao Asaas ${environment} nao encontrada.` }, { status: 409 })
    }

    const review = await createAdjustmentReview({
      connectionId: connection.id,
      saleId: id,
      indexName: String(data.indexName || ''),
      percentage: String(data.percentage || ''),
      source: String(data.source || ''),
      reason: String(data.reason || ''),
      createdById: auth.session.user.id,
    })
    return NextResponse.json(review, { status: 201 })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Nao foi possivel criar o reajuste.',
    }, { status: 400 })
  }
}
