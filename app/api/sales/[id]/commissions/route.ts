import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, saleAccessWhere } from '@/lib/access-control'
import { calculateCommissionAvailability, commissionAmount, getCommissionReleaseContext, syncSaleCommissions } from '@/lib/commissions'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

async function getSale(id: string, userId: string) {
  return prisma.sale.findFirst({
    where: { id, ...saleAccessWhere(userId) },
    include: {
      lot: { include: { block: { include: { development: { include: { settings: true } } } } } },
    },
  })
}

async function getPayload(saleId: string, developmentId: string, companyId: string, userId: string) {
  await syncSaleCommissions(prisma, saleId)
  const [commissions, developmentUsers, companyUsers, canEdit, canPay] = await Promise.all([
    prisma.saleCommission.findMany({
      where: { saleId },
      include: { user: { select: { id: true, name: true, email: true } }, payments: { orderBy: { paidAt: 'desc' } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.developmentUser.findMany({
      where: { developmentId, roles: { some: { role: { name: { in: ['vendedor', 'sales', 'gestor', 'manager'], mode: 'insensitive' } } } } },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.companyUser.findMany({
      where: { companyId, roles: { some: { role: { name: { in: ['vendedor', 'sales', 'gestor', 'manager'], mode: 'insensitive' } } } } },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
    hasDevelopmentPermission(userId, developmentId, 'manageSettings'),
    hasDevelopmentPermission(userId, developmentId, 'finance'),
  ])
  const brokers = [...developmentUsers, ...companyUsers].map((item) => item.user).concat(commissions.map((item) => item.user))
  const uniqueBrokers = [...new Map(brokers.map((broker) => [broker.id, broker])).values()].sort((a, b) => a.name.localeCompare(b.name))
  const releaseContext = await getCommissionReleaseContext(prisma, saleId)
  const enrichedCommissions = commissions.map((commission) => {
    const paid = commission.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    return { ...commission, ...calculateCommissionAvailability(Number(commission.amount), paid, releaseContext) }
  })
  return { commissions: enrichedCommissions, brokers: uniqueBrokers, canEdit, canPay, entryPaidPercentage: releaseContext.entryPaidRatio * 100 }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const { id } = await params
  const sale = await getSale(id, auth.session.user.id)
  const development = sale?.lot.block.development
  if (!sale || !development) return forbiddenResponse()
  const payload = await getPayload(id, development.id, development.companyId, auth.session.user.id)
  return NextResponse.json({
    sale: { id: sale.id, salePrice: sale.salePrice, downPayment: sale.downPayment },
    defaultPercentage: development.settings?.defaultCommissionPercentage ?? 6,
    ...payload,
  })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const { id } = await params
  const sale = await getSale(id, auth.session.user.id)
  const development = sale?.lot.block.development
  if (!sale || !development || !(await hasDevelopmentPermission(auth.session.user.id, development.id, 'manageSettings'))) return forbiddenResponse()

  const data = await req.json()
  const allocations = Array.isArray(data.allocations) ? data.allocations : []
  const normalized = allocations.map((item: { userId?: unknown; percentage?: unknown }) => ({ userId: String(item.userId ?? ''), percentage: Number(item.percentage) }))
  const total = normalized.reduce((sum: number, item: { percentage: number }) => sum + item.percentage, 0)
  if (normalized.some((item: { userId: string; percentage: number }) => !item.userId || !Number.isFinite(item.percentage) || item.percentage <= 0) || total > 100) {
    return NextResponse.json({ error: 'Informe corretores e percentuais validos. O total nao pode ultrapassar 100%.' }, { status: 400 })
  }
  if (new Set(normalized.map((item: { userId: string }) => item.userId)).size !== normalized.length) {
    return NextResponse.json({ error: 'O mesmo corretor nao pode aparecer duas vezes.' }, { status: 400 })
  }
  const existingPayments = await prisma.commissionPayment.count({ where: { commission: { saleId: id } } })
  if (existingPayments > 0) return NextResponse.json({ error: 'Nao e possivel alterar a divisao depois de registrar pagamentos.' }, { status: 409 })

  await prisma.$transaction(async (tx) => {
    await tx.saleCommission.deleteMany({ where: { saleId: id } })
    if (normalized.length) await tx.saleCommission.createMany({
      data: normalized.map((item: { userId: string; percentage: number }) => ({
        saleId: id,
        userId: item.userId,
        percentage: item.percentage,
        amount: commissionAmount(Number(sale.salePrice), item.percentage),
      })),
    })
    await syncSaleCommissions(tx, id)
  })

  return GET(req, { params: Promise.resolve({ id }) })
}
