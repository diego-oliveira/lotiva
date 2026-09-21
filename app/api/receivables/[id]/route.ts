import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, receivableAccessWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'
import { createLotEvent } from '@/lib/lot-events'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { createFinancialAuditLog } from '@/lib/payments/audit'
import { getPaymentProviderForConnection } from '@/lib/payments/factory'
import { synchronizeExternalCharge } from '@/lib/payments/synchronize-charge'

type Params = { params: Promise<{ id: string }> }

function parseDateOnly(value?: string | null) {
  if (!value) return new Date()
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return new Date()
  return new Date(year, month - 1, day, 12)
}

function parseRequiredDateOnly(value?: string | null) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day, 12)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

function addMonthsClamped(date: Date, months: number) {
  const year = date.getFullYear()
  const month = date.getMonth() + months
  const day = date.getDate()
  const lastDay = new Date(year, month + 1, 0, 12).getDate()
  return new Date(year, month, Math.min(day, lastDay), 12)
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id

  const { id } = await params
  const data = await req.json()

  const receivable = await prisma.receivable.findFirst({
    where: {
      id,
      ...receivableAccessWhere(currentUserId),
    },
    include: {
      sale: {
        include: {
          user: true,
          lot: {
            include: {
              block: { include: { development: true } },
            },
          },
        },
      },
      externalCharges: true,
    },
  })

  if (!receivable) return forbiddenResponse()

  const developmentId = receivable.sale.lot.block.developmentId
  if (!developmentId || !(await hasDevelopmentPermission(currentUserId, developmentId, 'issuePayments'))) {
    return forbiddenResponse()
  }

  if (typeof data.dueDate === 'string') {
    if (receivable.status === 'paid' || Number(receivable.paidAmount) > 0) {
      return NextResponse.json({ error: 'O vencimento de uma parcela paga nao pode ser alterado.' }, { status: 409 })
    }
    const requestedDueDate = parseRequiredDateOnly(data.dueDate)
    if (!requestedDueDate) {
      return NextResponse.json({ error: 'Informe uma data de vencimento valida.' }, { status: 400 })
    }
    const updateFollowing = data.scope === 'following'
    const targets = await prisma.receivable.findMany({
      where: {
        saleId: receivable.saleId,
        status: { not: 'paid' },
        paidAmount: { lte: 0 },
        ...(updateFollowing
          ? receivable.kind === 'installment'
            ? { kind: 'installment', sequence: { gte: receivable.sequence } }
            : {}
          : { id: receivable.id }),
      },
      include: {
        externalCharges: {
          where: { status: { notIn: ['cancelled', 'refunded', 'confirmed', 'received'] } },
        },
      },
      orderBy: [{ sequence: 'asc' }],
    })

    const dueDateFor = (target: typeof targets[number]) => {
      if (!updateFollowing) return requestedDueDate
      const offset = receivable.kind === 'installment'
        ? target.sequence - receivable.sequence
        : target.kind === 'down_payment' ? 0 : target.sequence
      return addMonthsClamped(requestedDueDate, offset)
    }

    try {
      for (const target of targets) {
        const nextDueDate = dueDateFor(target)
        for (const charge of target.externalCharges) {
          const { provider } = await getPaymentProviderForConnection(charge.connectionId)
          const updatedCharge = await provider.updateCharge(charge.providerChargeId, {
            amount: charge.amount.toString(),
            dueDate: dateKey(nextDueDate),
            billingType: charge.billingType === 'PIX' ? 'PIX' : 'BOLETO',
            description: `${target.kind === 'down_payment' ? 'Entrada' : `Parcela ${target.sequence}`} da venda ${target.saleId}`,
            externalReference: charge.externalReference,
          })
          await synchronizeExternalCharge({
            db: prisma,
            externalChargeId: charge.id,
            charge: updatedCharge,
            source: 'manual',
            eventAt: new Date(),
            actorId: currentUserId,
            providerPayload: updatedCharge,
          })
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        for (const target of targets) {
          const previousDueDate = target.dueDate
          const nextDueDate = dueDateFor(target)
          await tx.receivable.update({ where: { id: target.id }, data: { dueDate: nextDueDate } })
          const companyId = receivable.sale.lot.block.development?.companyId
          if (companyId) {
            await createFinancialAuditLog(tx, {
              companyId,
              actorId: currentUserId,
              action: 'receivable_due_date_changed',
              entityType: 'receivable',
              entityId: target.id,
              saleId: target.saleId,
              receivableId: target.id,
              metadata: {
                previousDueDate: dateKey(previousDueDate),
                dueDate: dateKey(nextDueDate),
                scope: updateFollowing ? 'following' : 'single',
              },
            })
          }
        }
        const firstInstallment = targets.find(
          (target) => target.kind === 'installment' && target.sequence === 1,
        )
        if (firstInstallment) {
          await tx.sale.update({
            where: { id: receivable.saleId },
            data: { firstDueDate: dueDateFor(firstInstallment) },
          })
        }
        await createLotEvent(tx, {
          lotId: receivable.sale.lotId,
          userId: currentUserId,
          type: 'receivable_due_date_changed',
          title: 'Vencimento alterado',
          description: updateFollowing
            ? `Vencimento de ${receivable.kind === 'down_payment' ? 'entrada' : `parcela ${receivable.sequence}`} e seguintes alterado.`
            : `Vencimento de ${receivable.kind === 'down_payment' ? 'entrada' : `parcela ${receivable.sequence}`} alterado.`,
        })
        return tx.receivable.findUnique({ where: { id: receivable.id } })
      })
      return NextResponse.json(updated)
    } catch (error) {
      return NextResponse.json({
        error: 'Nao foi possivel alterar o vencimento.',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      }, { status: 400 })
    }
  }

  if (data.status === 'paid') {
    const activeCharge = receivable.externalCharges.find(
      (charge) => !['cancelled', 'refunded'].includes(charge.status),
    )
    if (activeCharge) {
      return NextResponse.json({
        error: 'Cancele a cobranca externa antes de registrar uma baixa manual.',
      }, { status: 409 })
    }
    const receivableAmount = Number(receivable.amount)
    const paidAmount = Number(data.paidAmount ?? receivableAmount)
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      return NextResponse.json({ error: 'Valor pago invalido.' }, { status: 400 })
    }

    const balance = Math.max(receivableAmount - paidAmount, 0)
    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.receivable.update({
        where: { id },
        data: {
          status: balance > 0 ? 'pending' : 'paid',
          paidAmount,
          balance,
          paidAt: parseDateOnly(data.paidAt),
          notes: typeof data.notes === 'string' ? data.notes.trim() || null : receivable.notes,
        },
      })

      await createLotEvent(tx, {
        lotId: receivable.sale.lotId,
        userId: currentUserId,
        type: 'payment_registered',
        title: 'Pagamento registrado',
        description: `${receivable.kind === 'down_payment' ? 'Entrada' : `Parcela ${receivable.sequence}`} de ${receivable.sale.user.name}: ${paidAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
        notes: typeof data.notes === 'string' ? data.notes.trim() || null : null,
      })
      const companyId = receivable.sale.lot.block.development?.companyId
      if (companyId) {
        await createFinancialAuditLog(tx, {
          companyId,
          actorId: currentUserId,
          action: 'receivable_paid_manually',
          entityType: 'receivable',
          entityId: receivable.id,
          saleId: receivable.saleId,
          receivableId: receivable.id,
          metadata: { paidAmount, paidAt: data.paidAt, notes: data.notes },
        })
      }

      return saved
    })

    return NextResponse.json(updated)
  }

  if (data.status === 'pending') {
    if (receivable.externalCharges.some((charge) => ['confirmed', 'received'].includes(charge.status))) {
      return NextResponse.json({
        error: 'A cobranca continua paga no provedor. Concilie ou estorne no Asaas antes de reabrir.',
      }, { status: 409 })
    }
    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.receivable.update({
        where: { id },
        data: {
          status: 'pending',
          paidAmount: 0,
          balance: receivable.amount,
          paidAt: null,
          notes: typeof data.notes === 'string' ? data.notes.trim() || null : receivable.notes,
        },
      })

      await createLotEvent(tx, {
        lotId: receivable.sale.lotId,
        userId: currentUserId,
        type: 'payment_reopened',
        title: 'Pagamento reaberto',
        description: `${receivable.kind === 'down_payment' ? 'Entrada' : `Parcela ${receivable.sequence}`} voltou para em aberto.`,
      })
      const companyId = receivable.sale.lot.block.development?.companyId
      if (companyId) {
        await createFinancialAuditLog(tx, {
          companyId,
          actorId: currentUserId,
          action: 'receivable_reopened_manually',
          entityType: 'receivable',
          entityId: receivable.id,
          saleId: receivable.saleId,
          receivableId: receivable.id,
        })
      }

      return saved
    })

    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Status invalido.' }, { status: 400 })
}
