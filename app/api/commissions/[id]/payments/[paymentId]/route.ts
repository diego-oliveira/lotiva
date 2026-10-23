import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@/app/generated/prisma'
import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse } from '@/lib/access-control'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { createFinancialAuditLog } from '@/lib/payments/audit'
import { parsePaymentDate, bahiaDate } from '@/lib/payment-dates'

type Params = { params: Promise<{ id: string; paymentId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const { id, paymentId } = await params
  const payment = await prisma.commissionPayment.findFirst({ where: { id: paymentId, commissionId: id }, include: { commission: { include: { sale: { select: { id: true, lot: { select: { block: { select: { developmentId: true, development: { select: { companyId: true } } } } } } } } } } } })
  const development = payment?.commission.sale.lot.block
  if (!payment || !development?.developmentId || !development.development || !(await hasDevelopmentPermission(auth.session.user.id, development.developmentId, 'finance'))) return forbiddenResponse()
  let data: { paidAt?: unknown; previousPaidAt?: unknown }
  try { data = await req.json() } catch { return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 }) }
  let paidAt: Date
  try { paidAt = parsePaymentDate(data?.paidAt) } catch { return NextResponse.json({ error: 'Informe uma data de pagamento válida.' }, { status: 400 }) }
  if (String(data.paidAt) > bahiaDate()) return NextResponse.json({ error: 'A data de pagamento não pode estar no futuro.' }, { status: 400 })
  if (data.previousPaidAt !== payment.paidAt.toISOString()) return NextResponse.json({ error: 'Este pagamento foi alterado. Atualize os dados antes de editar.' }, { status: 409 })
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.commissionPayment.updateMany({ where: { id: paymentId, commissionId: id, paidAt: payment.paidAt }, data: { paidAt } })
      if (!result.count) return false
      await createFinancialAuditLog(tx, {
        companyId: development.development!.companyId, actorId: auth.session.user.id,
        action: 'commission_payment_date_updated', entityType: 'commission_payment', entityId: paymentId,
        saleId: payment.commission.saleId,
        metadata: { commissionId: id, previousPaidAt: payment.paidAt, paidAt, amount: Number(payment.amount) },
      })
      return true
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    if (!updated) return NextResponse.json({ error: 'Este pagamento foi alterado. Atualize os dados antes de editar.' }, { status: 409 })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2034') return NextResponse.json({ error: 'Outra alteração ocorreu ao mesmo tempo. Atualize e tente novamente.' }, { status: 409 })
    console.error('commission_payment_date_update_failed', error)
    return NextResponse.json({ error: 'Não foi possível alterar a data do pagamento.' }, { status: 500 })
  }
}
