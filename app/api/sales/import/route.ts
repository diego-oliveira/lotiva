import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse } from '@/lib/access-control'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { createLotEvent } from '@/lib/lot-events'

type LegacySaleInput = {
  blockIdentifier?: string
  lotIdentifier?: string
  clientName?: string
  clientEmail?: string
  clientCpf?: string
  totalValue?: number
  downPayment?: number
  installmentCount?: number
  installmentValue?: number
  firstDueDate?: string
  downPaymentPaid?: boolean
  paidInstallments?: number
}

function parseDateOnly(value?: string | null) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day, 12)
}

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function toNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function normalizeDocument(value?: string) {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length <= 11) return digits.padStart(11, '0')
  if (digits.length <= 14) return digits.padStart(14, '0')
  return digits
}

function buildLegacyReceivables(input: {
  saleId: string
  downPayment: number
  installmentCount: number
  installmentValue: number
  firstDueDate: Date | null
  downPaymentPaid: boolean
  paidInstallments: number
}) {
  const now = new Date()
  const firstDueDate = input.firstDueDate ?? addMonths(now, 1)
  const receivables = []
  const downPaymentDueDate = input.firstDueDate ?? now

  if (input.downPayment > 0) {
    receivables.push({
      saleId: input.saleId,
      kind: 'down_payment',
      sequence: 0,
      dueDate: downPaymentDueDate,
      amount: input.downPayment,
      paidAmount: input.downPaymentPaid ? input.downPayment : 0,
      balance: input.downPaymentPaid ? 0 : input.downPayment,
      status: input.downPaymentPaid ? 'paid' : 'pending',
      paidAt: input.downPaymentPaid ? downPaymentDueDate : null,
      notes: 'Importado de venda legada.',
    })
  }

  for (let sequence = 1; sequence <= input.installmentCount; sequence += 1) {
    const paid = sequence <= input.paidInstallments
    receivables.push({
      saleId: input.saleId,
      kind: 'installment',
      sequence,
      dueDate: addMonths(firstDueDate, sequence - 1),
      amount: input.installmentValue,
      paidAmount: paid ? input.installmentValue : 0,
      balance: paid ? 0 : input.installmentValue,
      status: paid ? 'paid' : 'pending',
      paidAt: paid ? addMonths(firstDueDate, sequence - 1) : null,
      notes: 'Importado de venda legada.',
    })
  }

  return receivables
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id
  const payload = await req.json().catch(() => ({}))
  const developmentId = String(payload.developmentId || '')
  const rows = Array.isArray(payload.sales) ? payload.sales as LegacySaleInput[] : []

  if (!developmentId || !(await hasDevelopmentPermission(currentUserId, developmentId, 'sales'))) {
    return forbiddenResponse()
  }

  const development = await prisma.development.findUnique({
    where: { id: developmentId },
    select: { id: true, companyId: true },
  })
  if (!development) return forbiddenResponse()

  const errors: string[] = []
  if (rows.length === 0) errors.push('Inclua pelo menos uma venda.')
  if (rows.length > 300) errors.push('Importe no maximo 300 vendas por vez.')

  const rowKeys = rows.map((row) => `${String(row.blockIdentifier || '').trim().toLowerCase()}::${String(row.lotIdentifier || '').trim().toLowerCase()}`)
  rowKeys.forEach((key, index) => {
    if (key === '::') return
    if (rowKeys.indexOf(key) !== index) errors.push(`Linha ${index + 1}: lote repetido na planilha.`)
  })

  rows.forEach((row, index) => {
    const line = index + 1
    if (!String(row.blockIdentifier || '').trim()) errors.push(`Linha ${line}: quadra obrigatoria.`)
    if (!String(row.lotIdentifier || '').trim()) errors.push(`Linha ${line}: lote obrigatorio.`)
    if (!String(row.clientName || '').trim()) errors.push(`Linha ${line}: nome do cliente obrigatorio.`)
    if (!String(row.clientEmail || '').trim()) errors.push(`Linha ${line}: email do cliente obrigatorio.`)
    const document = normalizeDocument(row.clientCpf || '')
    if (document && ![11, 14].includes(document.length)) errors.push(`Linha ${line}: CPF/CNPJ invalido.`)
    if (toNumber(row.totalValue) <= 0) errors.push(`Linha ${line}: valor da venda deve ser maior que zero.`)
    if (toNumber(row.downPayment) < 0) errors.push(`Linha ${line}: entrada nao pode ser negativa.`)
    if (Math.trunc(toNumber(row.installmentCount)) < 0) errors.push(`Linha ${line}: numero de parcelas invalido.`)
    if (toNumber(row.installmentValue) < 0) errors.push(`Linha ${line}: valor da parcela nao pode ser negativo.`)
    if (Math.trunc(toNumber(row.paidInstallments)) > Math.trunc(toNumber(row.installmentCount))) {
      errors.push(`Linha ${line}: parcelas pagas nao pode ser maior que o total de parcelas.`)
    }
    if (Math.trunc(toNumber(row.installmentCount)) > 0 && !parseDateOnly(row.firstDueDate)) {
      errors.push(`Linha ${line}: primeiro vencimento obrigatorio para venda parcelada.`)
    }
  })

  const lots = await prisma.lot.findMany({
    where: {
      block: { developmentId },
    },
    include: {
      block: true,
      sale: true,
    },
  })
  const lotsByKey = new Map(lots.map((lot) => [`${lot.block.identifier.toLowerCase()}::${lot.identifier.toLowerCase()}`, lot]))

  rows.forEach((row, index) => {
    const key = `${String(row.blockIdentifier || '').trim().toLowerCase()}::${String(row.lotIdentifier || '').trim().toLowerCase()}`
    const lot = lotsByKey.get(key)
    if (!lot) errors.push(`Linha ${index + 1}: lote nao encontrado para quadra/lote informados.`)
    if (lot?.sale) errors.push(`Linha ${index + 1}: lote ja possui venda cadastrada.`)
  })

  const cpfs = rows.map((row) => normalizeDocument(row.clientCpf)).filter((cpf): cpf is string => Boolean(cpf))
  const emails = rows.map((row) => String(row.clientEmail || '').trim().toLowerCase()).filter(Boolean)
  const existingUsers = await prisma.user.findMany({
    where: {
      OR: [
        ...(cpfs.length > 0 ? [{ cpf: { in: cpfs } }] : []),
        ...(emails.length > 0 ? [{ email: { in: emails } }] : []),
      ],
    },
  })
  const usersByCpf = new Map(existingUsers.filter((user) => user.cpf).map((user) => [user.cpf!, user]))
  const usersByEmail = new Map(existingUsers.map((user) => [user.email.toLowerCase(), user]))

  if (errors.length > 0) {
    return NextResponse.json({ error: 'Revise os dados antes de importar as vendas.', errors }, { status: 400 })
  }

  const result = await prisma.$transaction(async (tx) => {
    const createdSales = []

    for (const row of rows) {
      const cpf = normalizeDocument(row.clientCpf)
      const email = String(row.clientEmail || '').trim().toLowerCase()
      let user = (cpf ? usersByCpf.get(cpf) : null) ?? usersByEmail.get(email) ?? null

      if (!user) {
        user = await tx.user.create({
          data: {
            name: String(row.clientName || '').trim(),
            email,
            cpf,
          },
        })
        if (cpf) usersByCpf.set(cpf, user)
        usersByEmail.set(email, user)
      }

      await tx.developmentUser.upsert({
        where: {
          developmentId_userId: {
            developmentId,
            userId: user.id,
          },
        },
        create: {
          developmentId,
          userId: user.id,
        },
        update: {},
      })

      const lotKey = `${String(row.blockIdentifier || '').trim().toLowerCase()}::${String(row.lotIdentifier || '').trim().toLowerCase()}`
      const lot = lotsByKey.get(lotKey)!
      const installmentCount = Math.trunc(toNumber(row.installmentCount))
      const totalValue = toNumber(row.totalValue)
      const downPayment = toNumber(row.downPayment)
      const installmentValue = installmentCount > 0
        ? toNumber(row.installmentValue) || Math.max((totalValue - downPayment) / installmentCount, 0)
        : 0
      const firstDueDate = parseDateOnly(row.firstDueDate)

      const sale = await tx.sale.create({
        data: {
          userId: user.id,
          createdById: currentUserId,
          lotId: lot.id,
          installmentCount,
          installmentValue,
          downPayment,
          firstDueDate,
          annualAdjustment: false,
          totalValue,
        },
      })

      const receivables = buildLegacyReceivables({
        saleId: sale.id,
        downPayment,
        installmentCount,
        installmentValue,
        firstDueDate,
        downPaymentPaid: Boolean(row.downPaymentPaid),
        paidInstallments: Math.trunc(toNumber(row.paidInstallments)),
      })
      if (receivables.length > 0) await tx.receivable.createMany({ data: receivables })

      await tx.lot.update({
        where: { id: lot.id },
        data: { status: 'sold' },
      })
      await createLotEvent(tx, {
        lotId: lot.id,
        userId: currentUserId,
        type: 'legacy_sale_imported',
        title: 'Venda legada importada',
        description: `Venda legada importada para ${user.name}.`,
      })

      createdSales.push(sale)
    }

    return { sales: createdSales }
  })

  return NextResponse.json(result, { status: 201 })
}
