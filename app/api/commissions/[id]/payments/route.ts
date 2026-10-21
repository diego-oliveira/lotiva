import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse } from '@/lib/access-control'
import { calculateCommissionAvailability, getCommissionReleaseContext, syncSaleCommissions } from '@/lib/commissions'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const { id } = await params
  const commission = await prisma.saleCommission.findUnique({
    where: { id },
    include: { payments: true, sale: { include: { lot: { include: { block: true } } } } },
  })
  const developmentId = commission?.sale.lot.block.developmentId
  if (!commission || !developmentId || !(await hasDevelopmentPermission(auth.session.user.id, developmentId, 'finance'))) return forbiddenResponse()
  await syncSaleCommissions(prisma, commission.saleId)
  const current = await prisma.saleCommission.findUnique({ where: { id }, include: { payments: true } })
  if (!current) return NextResponse.json({ error: 'Comissao nao encontrada.' }, { status: 404 })
  const data = await req.json()
  const amount = Number(data.amount)
  const alreadyPaid = current.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  const context = await getCommissionReleaseContext(prisma, commission.saleId)
  const { availableAmount } = calculateCommissionAvailability(Number(current.amount), alreadyPaid, context)
  if (availableAmount <= 0) return NextResponse.json({ error: 'Ainda nao existe valor de comissao liberado. Registre primeiro o pagamento de uma parcela da entrada.' }, { status: 409 })
  if (!Number.isFinite(amount) || amount <= 0 || amount > availableAmount + 0.005) return NextResponse.json({ error: `Informe um valor valido, limitado ao saldo liberado de ${availableAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.` }, { status: 400 })
  const paidAt = data.paidAt ? new Date(`${data.paidAt}T12:00:00`) : new Date()
  if (Number.isNaN(paidAt.getTime())) return NextResponse.json({ error: 'Data de pagamento invalida.' }, { status: 400 })
  await prisma.commissionPayment.create({ data: {
    commissionId: id,
    amount,
    paidAt,
    pixKey: typeof data.pixKey === 'string' ? data.pixKey.trim() || null : null,
    notes: typeof data.notes === 'string' ? data.notes.trim() || null : null,
    proofUrl: typeof data.proofUrl === 'string' ? data.proofUrl.trim() || null : null,
    createdById: auth.session.user.id,
  } })
  await syncSaleCommissions(prisma, commission.saleId)
  return NextResponse.json({ success: true })
}
