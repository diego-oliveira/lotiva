import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/auth'
import { membershipWhere } from '@/lib/access-control'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/app/generated/prisma'
import { hasAnyDevelopmentPermission, hasDevelopmentPermission } from '@/lib/permissions'
import ReceivableActions from './components/ReceivableActions'
import PaymentOperationsPanel from './components/PaymentOperationsPanel'
import { hasCompanyPermission } from '@/lib/permissions'

type FinancePageProps = {
  searchParams?: Promise<{
    developmentId?: string
    status?: string
    search?: string
    dueFrom?: string
    dueTo?: string
    view?: string
    month?: string
    day?: string
    calendarBy?: string
  }>
}

type FinanceView = 'calendar' | 'list' | 'summary'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString('pt-BR')
}

function parseDateOnly(value?: string) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function formatDateInput(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseMonth(value: string | undefined, fallback: Date) {
  const match = value?.match(/^(\d{4})-(\d{2})$/)
  if (!match) return new Date(fallback.getFullYear(), fallback.getMonth(), 1)
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return new Date(fallback.getFullYear(), fallback.getMonth(), 1)
  return new Date(year, month - 1, 1)
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1)
}

function monthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(value: Date) {
  const label = value.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate()
}

function getReceivableLabel(receivable: { kind: string; sequence: number }) {
  if (receivable.kind === 'down_payment') return 'Entrada'
  return `Parcela ${receivable.sequence}`
}

function getStatusMeta(receivable: { status: string; dueDate: Date }) {
  if (receivable.status === 'paid') {
    return { label: 'Paga', className: 'bg-emerald-50 text-emerald-700' }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (receivable.dueDate < today) {
    return { label: 'Vencida', className: 'bg-red-50 text-red-700' }
  }

  return { label: 'A vencer', className: 'bg-amber-50 text-amber-700' }
}

export default async function FinancePage({ searchParams }: FinancePageProps) {
  const session = await getCurrentSession()
  if (!session?.user?.id) redirect('/signin')
  if (!(await hasAnyDevelopmentPermission(session.user.id, 'finance'))) redirect('/')

  const params = await searchParams
  const view: FinanceView = params?.view === 'list' || params?.view === 'summary' ? params.view : 'calendar'
  const calendarBy = params?.calendarBy === 'due' ? 'due' : 'payment'
  const now = new Date()
  const selectedMonth = parseMonth(params?.month, now)
  const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)
  const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59, 999)
  const defaultSummaryFrom = new Date(now.getFullYear(), 0, 1)
  const defaultSummaryTo = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
  const status = params?.status || (view === 'list' ? 'open' : 'all')
  const search = params?.search?.trim() || ''
  const dueFrom = view === 'calendar' ? monthStart : parseDateOnly(params?.dueFrom) ?? (view === 'summary' ? defaultSummaryFrom : null)
  const dueTo = view === 'calendar' ? monthEnd : parseDateOnly(params?.dueTo) ?? (view === 'summary' ? defaultSummaryTo : null)
  if (dueTo) dueTo.setHours(23, 59, 59, 999)

  const developments = await prisma.development.findMany({
    where: membershipWhere(session.user.id),
    include: { company: true },
    orderBy: { name: 'asc' },
  })
  const selectedDevelopment =
    developments.find((development) => development.id === params?.developmentId) ?? developments[0] ?? null

  if (selectedDevelopment && !(await hasDevelopmentPermission(session.user.id, selectedDevelopment.id, 'finance'))) {
    redirect('/')
  }
  const canManagePayments = selectedDevelopment
    ? await hasDevelopmentPermission(session.user.id, selectedDevelopment.id, 'issuePayments')
    : false

  if (!selectedDevelopment) {
    return (
      <div className='space-y-6'>
        <div>
          <h1 className='page-title'>Financeiro</h1>
          <p className='page-subtitle'>Crie um empreendimento para operar contas a receber.</p>
        </div>
        <section className='panel px-6 py-10 text-center'>
          <h2 className='text-lg font-semibold text-foreground'>Nenhum empreendimento acessivel</h2>
          <p className='mt-2 text-sm text-muted'>O financeiro depende de vendas e parcelas associadas a um empreendimento.</p>
          <Link href='/developments' className='mt-6 inline-flex rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong'>
            Criar empreendimento
          </Link>
        </section>
      </div>
    )
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dueDateFilter: Prisma.ReceivableWhereInput =
    dueFrom || dueTo
      ? {
          dueDate: {
            ...(dueFrom ? { gte: dueFrom } : {}),
            ...(dueTo ? { lte: dueTo } : {}),
          },
        }
      : {}

  const statusFilter: Prisma.ReceivableWhereInput =
    status === 'paid'
      ? { status: 'paid' }
      : status === 'overdue'
        ? { status: { not: 'paid' }, dueDate: { lt: today } }
        : status === 'upcoming'
          ? { status: { not: 'paid' }, dueDate: { gte: today } }
          : status === 'all'
            ? {}
            : { status: { not: 'paid' } }

  const containsInsensitive = { contains: search, mode: 'insensitive' as const }
  const searchFilter: Prisma.ReceivableWhereInput = search
    ? {
        OR: [
          { sale: { is: { id: { contains: search } } } },
          { sale: { is: { user: { is: { name: containsInsensitive } } } } },
          { sale: { is: { user: { is: { email: containsInsensitive } } } } },
          { sale: { is: { user: { is: { cpf: { contains: search.replace(/\D/g, '') } } } } } },
          { sale: { is: { lot: { is: { identifier: containsInsensitive } } } } },
          { sale: { is: { lot: { is: { block: { is: { identifier: containsInsensitive } } } } } } },
        ],
      }
    : {}

  const receivableWhere: Prisma.ReceivableWhereInput = {
    AND: [
      {
        sale: {
          is: {
            lot: {
              is: {
                block: {
                  is: {
                    developmentId: selectedDevelopment.id,
                  },
                },
              },
            },
          },
        },
      },
      dueDateFilter,
      statusFilter,
      searchFilter,
    ],
  }

  const receivables = await prisma.receivable.findMany({
    where: receivableWhere,
    include: {
      sale: {
        include: {
          user: true,
          lot: { include: { block: true } },
        },
      },
      externalCharges: {
        include: {
          connection: { select: { provider: true } },
        },
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
    orderBy: [
      { dueDate: 'asc' },
      { sequence: 'asc' },
    ],
  })

  const paidInPeriod = view !== 'list' && dueFrom && dueTo
    ? await prisma.receivable.findMany({
        where: {
          status: 'paid',
          paidAt: { gte: dueFrom, lte: dueTo },
          sale: {
            is: {
              lot: { is: { block: { is: { developmentId: selectedDevelopment.id } } } },
            },
          },
        },
        include: {
          sale: {
            include: {
              user: true,
              lot: { include: { block: true } },
            },
          },
          externalCharges: {
            include: {
              connection: { select: { provider: true } },
            },
            orderBy: { version: 'desc' },
            take: 1,
          },
        },
        orderBy: [
          { paidAt: 'asc' },
          { sequence: 'asc' },
        ],
      })
    : []

  const summary = receivables.reduce(
    (acc, receivable) => {
      acc.expected += Number(receivable.amount)
      acc.received += Number(receivable.paidAmount)
      if (receivable.status !== 'paid') acc.open += Number(receivable.balance)
      if (receivable.status !== 'paid' && receivable.dueDate < today) {
        acc.overdue += Number(receivable.balance)
        acc.overdueCount += 1
      }
      if (receivable.status === 'paid') acc.paidCount += 1
      return acc
    },
    { expected: 0, received: 0, open: 0, overdue: 0, overdueCount: 0, paidCount: 0 },
  )

  if (view !== 'list') {
    summary.received = paidInPeriod.reduce((total, receivable) => total + Number(receivable.paidAmount), 0)
    summary.paidCount = paidInPeriod.length
  }

  const calendarReceivables = calendarBy === 'payment' ? paidInPeriod : receivables
  const receivablesByDay = new Map<string, typeof calendarReceivables>()
  calendarReceivables.forEach((receivable) => {
    const calendarDate = calendarBy === 'payment' ? receivable.paidAt! : receivable.dueDate
    const key = formatDateInput(calendarDate)
    receivablesByDay.set(key, [...(receivablesByDay.get(key) ?? []), receivable])
  })
  const selectedDay = parseDateOnly(params?.day)
    ?? (sameDay(selectedMonth, now) || (selectedMonth.getFullYear() === now.getFullYear() && selectedMonth.getMonth() === now.getMonth())
      ? now
      : monthStart)
  const selectedDayKey = formatDateInput(selectedDay)
  const selectedDayReceivables = receivablesByDay.get(selectedDayKey) ?? []

  const calendarStart = new Date(monthStart)
  calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay())
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart)
    date.setDate(calendarStart.getDate() + index)
    return date
  })

  const monthlySummary = new Map<string, { month: Date; expected: number; received: number; open: number; overdue: number; count: number }>()
  receivables.forEach((receivable) => {
    const key = monthKey(receivable.dueDate)
    const row = monthlySummary.get(key) ?? {
      month: new Date(receivable.dueDate.getFullYear(), receivable.dueDate.getMonth(), 1),
      expected: 0,
      received: 0,
      open: 0,
      overdue: 0,
      count: 0,
    }
    row.expected += Number(receivable.amount)
    row.open += receivable.status === 'paid' ? 0 : Number(receivable.balance)
    row.overdue += receivable.status !== 'paid' && receivable.dueDate < today ? Number(receivable.balance) : 0
    row.count += 1
    monthlySummary.set(key, row)
  })
  paidInPeriod.forEach((receivable) => {
    if (!receivable.paidAt) return
    const key = monthKey(receivable.paidAt)
    const row = monthlySummary.get(key) ?? {
      month: new Date(receivable.paidAt.getFullYear(), receivable.paidAt.getMonth(), 1),
      expected: 0,
      received: 0,
      open: 0,
      overdue: 0,
      count: 0,
    }
    row.received += Number(receivable.paidAmount)
    monthlySummary.set(key, row)
  })
  const monthlyRows = [...monthlySummary.values()].sort((left, right) => left.month.getTime() - right.month.getTime())

  const [
    connections,
    failedWebhooks,
    pendingDivergences,
    canReconcile,
    failedEvents,
    divergences,
  ] = await Promise.all([
    prisma.paymentProviderConnection.findMany({
      where: { companyId: selectedDevelopment.companyId, status: 'active' },
      include: {
        reconciliationRuns: {
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ provider: 'asc' }, { environment: 'asc' }],
    }),
    prisma.paymentWebhookEvent.count({
      where: {
        connection: { companyId: selectedDevelopment.companyId },
        status: 'failed',
      },
    }),
    prisma.reconciliationDivergence.count({
      where: {
        reconciliationRun: {
          connection: { companyId: selectedDevelopment.companyId },
        },
        status: 'pending',
      },
    }),
    hasCompanyPermission(session.user.id, selectedDevelopment.companyId, 'reconcilePayments'),
    prisma.paymentWebhookEvent.findMany({
      where: {
        connection: { companyId: selectedDevelopment.companyId },
        status: 'failed',
      },
      select: { id: true, eventType: true, errorMessage: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.reconciliationDivergence.findMany({
      where: {
        reconciliationRun: {
          connection: { companyId: selectedDevelopment.companyId },
        },
        status: 'pending',
      },
      select: { id: true, type: true, resolution: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='page-title'>Financeiro</h1>
          <p className='page-subtitle'>Localize parcelas, acompanhe vencidos e registre baixas de pagamento.</p>
        </div>
        <Link href={`/sales?developmentId=${selectedDevelopment.id}`} className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'>
          Ver vendas
        </Link>
      </div>

      <section className='panel px-6 py-5'>
        <div>
          <div>
            <h2 className='text-2xl font-bold text-foreground'>{selectedDevelopment.name}</h2>
            <p className='mt-1 text-sm text-muted'>
              {selectedDevelopment.company.name} · {view === 'calendar' ? calendarReceivables.length : receivables.length} registro(s) no recorte financeiro atual.
            </p>
          </div>
        </div>
      </section>

      <nav className='flex flex-wrap gap-2 rounded-2xl border border-border bg-surface p-2'>
        {([
          ['calendar', 'Calendario'],
          ['list', 'Lista'],
          ['summary', 'Resumo mensal'],
        ] as const).map(([value, label]) => (
          <Link
            key={value}
            href={`/finance?developmentId=${selectedDevelopment.id}&view=${value}${value === 'calendar' ? `&month=${monthKey(selectedMonth)}&calendarBy=${calendarBy}` : ''}`}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${view === value ? 'bg-primary text-white' : 'text-muted hover:bg-surface-secondary hover:text-foreground'}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {view === 'calendar' && (
        <section className='panel flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex items-center justify-between gap-2 sm:justify-start'>
            <Link href={`/finance?developmentId=${selectedDevelopment.id}&view=calendar&month=${monthKey(addMonths(selectedMonth, -1))}&calendarBy=${calendarBy}`} className='rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface-secondary' aria-label='Mes anterior'>←</Link>
            <h2 className='min-w-48 text-center text-lg font-bold text-foreground'>{monthLabel(selectedMonth)}</h2>
            <Link href={`/finance?developmentId=${selectedDevelopment.id}&view=calendar&month=${monthKey(addMonths(selectedMonth, 1))}&calendarBy=${calendarBy}`} className='rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface-secondary' aria-label='Proximo mes'>→</Link>
          </div>
          <div className='flex flex-col gap-2 sm:flex-row'>
            <div className='inline-flex rounded-xl border border-border bg-background p-1'>
              <Link href={`/finance?developmentId=${selectedDevelopment.id}&view=calendar&month=${monthKey(selectedMonth)}&calendarBy=payment`} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${calendarBy === 'payment' ? 'bg-primary text-white' : 'text-muted hover:bg-surface-secondary'}`}>Pagamentos</Link>
              <Link href={`/finance?developmentId=${selectedDevelopment.id}&view=calendar&month=${monthKey(selectedMonth)}&calendarBy=due`} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${calendarBy === 'due' ? 'bg-primary text-white' : 'text-muted hover:bg-surface-secondary'}`}>Vencimentos</Link>
            </div>
            <Link href={`/finance?developmentId=${selectedDevelopment.id}&view=calendar&month=${monthKey(now)}&day=${formatDateInput(now)}&calendarBy=${calendarBy}`} className='rounded-xl border border-border px-4 py-2 text-center text-sm font-semibold text-foreground hover:bg-surface-secondary'>Hoje</Link>
          </div>
        </section>
      )}

      <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-5'>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>{view === 'calendar' ? 'Previsto no mes' : 'Previsto'}</p>
          <p className='metric-value'>{formatCurrency(summary.expected)}</p>
        </div>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>{view === 'calendar' ? 'Recebido no mes' : 'Recebido'}</p>
          <p className='metric-value text-emerald-700'>{formatCurrency(summary.received)}</p>
        </div>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Em aberto</p>
          <p className='metric-value'>{formatCurrency(summary.open)}</p>
        </div>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Vencido</p>
          <p className={`metric-value ${summary.overdue > 0 ? 'text-red-700' : ''}`}>{formatCurrency(summary.overdue)}</p>
        </div>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Parcelas vencidas</p>
          <p className={`metric-value ${summary.overdueCount > 0 ? 'text-red-700' : ''}`}>{summary.overdueCount}</p>
        </div>
      </section>

      {view === 'calendar' && (
        <div className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]'>
          <section className='panel overflow-hidden'>
            <div className='grid grid-cols-7 border-b border-border bg-surface-secondary'>
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((label) => (
                <div key={label} className='px-1 py-3 text-center text-[10px] font-bold uppercase text-muted sm:text-xs'>{label}</div>
              ))}
            </div>
            <div className='grid grid-cols-7'>
              {calendarDays.map((date) => {
                const key = formatDateInput(date)
                const items = receivablesByDay.get(key) ?? []
                const inMonth = date.getMonth() === selectedMonth.getMonth() && date.getFullYear() === selectedMonth.getFullYear()
                const total = items.reduce((sum, item) => sum + Number(calendarBy === 'payment' ? item.paidAmount : item.amount), 0)
                const allPaid = items.length > 0 && items.every((item) => item.status === 'paid')
                const hasOverdue = items.some((item) => item.status !== 'paid' && item.dueDate < today)
                const hasDueToday = items.some((item) => item.status !== 'paid' && sameDay(item.dueDate, today))
                const tone = calendarBy === 'payment'
                  ? items.length > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-surface text-foreground'
                  : hasOverdue
                  ? 'bg-red-50 text-red-800'
                  : hasDueToday
                    ? 'bg-amber-50 text-amber-800'
                    : allPaid
                      ? 'bg-emerald-50 text-emerald-800'
                      : items.length > 0
                        ? 'bg-blue-50 text-blue-800'
                        : 'bg-surface text-foreground'
                return (
                  <Link
                    key={key}
                    href={`/finance?developmentId=${selectedDevelopment.id}&view=calendar&month=${monthKey(date)}&day=${key}&calendarBy=${calendarBy}`}
                    className={`min-h-20 border-b border-r border-border p-1.5 transition hover:brightness-95 sm:min-h-28 sm:p-3 ${tone} ${!inMonth ? 'opacity-35' : ''} ${key === selectedDayKey ? 'relative z-10 ring-2 ring-inset ring-primary' : ''}`}
                  >
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold sm:text-sm ${sameDay(date, today) ? 'bg-primary text-white' : ''}`}>{date.getDate()}</span>
                    {items.length > 0 && (
                      <div className='mt-1'>
                        <p className='text-[10px] font-bold sm:text-xs'>{items.length} {calendarBy === 'payment' ? (items.length === 1 ? 'pagamento' : 'pagamentos') : (items.length === 1 ? 'parcela' : 'parcelas')}</p>
                        <p className='mt-1 hidden text-xs font-semibold sm:block'>{formatCurrency(total)}</p>
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
            <div className='flex flex-wrap gap-4 border-t border-border px-4 py-3 text-xs text-muted'>
              {calendarBy === 'payment' ? (
                <span><i className='mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500' />Pagamentos recebidos pela data da baixa</span>
              ) : (
                <>
                  <span><i className='mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500' />Pagas</span>
                  <span><i className='mr-1 inline-block h-2.5 w-2.5 rounded-full bg-blue-500' />A vencer</span>
                  <span><i className='mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-500' />Hoje</span>
                  <span><i className='mr-1 inline-block h-2.5 w-2.5 rounded-full bg-red-500' />Vencidas</span>
                </>
              )}
            </div>
          </section>

          <section className='panel self-start overflow-hidden'>
            <div className='panel-header px-5 py-4'>
              <h2 className='text-base font-bold text-foreground'>{formatDate(selectedDay)}</h2>
              <p className='mt-1 text-sm text-muted'>{selectedDayReceivables.length} {calendarBy === 'payment' ? 'pagamento(s) registrado(s)' : 'parcela(s) com vencimento'} nesta data.</p>
            </div>
            {selectedDayReceivables.length === 0 ? (
              <p className='px-5 py-10 text-center text-sm text-muted'>{calendarBy === 'payment' ? 'Nenhum pagamento registrado neste dia.' : 'Nenhum vencimento neste dia.'}</p>
            ) : (
              <div className='divide-y divide-border'>
                {selectedDayReceivables.map((receivable) => {
                  const itemStatus = getStatusMeta(receivable)
                  return (
                    <article key={receivable.id} className='space-y-3 px-5 py-4'>
                      <div className='flex items-start justify-between gap-3'>
                        <div>
                          <p className='text-sm font-semibold text-foreground'>{receivable.sale.user.name}</p>
                          <p className='mt-1 text-xs text-muted'>Quadra {receivable.sale.lot.block.identifier}, Lote {receivable.sale.lot.identifier} · {getReceivableLabel(receivable)}</p>
                        </div>
                        <span className={`pill shrink-0 ${itemStatus.className}`}>{itemStatus.label}</span>
                      </div>
                      <p className='text-lg font-bold text-foreground'>{formatCurrency(Number(calendarBy === 'payment' ? receivable.paidAmount : receivable.amount))}</p>
                      {receivable.paidAt && <p className='text-xs font-semibold text-emerald-700'>Paga em {formatDate(receivable.paidAt)}</p>}
                      <ReceivableActions
                        canManagePayments={canManagePayments}
                        receivable={{
                          id: receivable.id,
                          kind: receivable.kind,
                          dueDate: receivable.dueDate.toISOString(),
                          amount: Number(receivable.amount),
                          balance: Number(receivable.balance),
                          paidAmount: Number(receivable.paidAmount),
                          status: receivable.status,
                          notes: receivable.notes,
                          hasActiveCharge: Boolean(receivable.externalCharges[0] && !['cancelled', 'refunded'].includes(receivable.externalCharges[0].status)),
                        }}
                      />
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {view === 'summary' && (
        <section className='panel overflow-hidden'>
          <form action='/finance' className='panel-header grid gap-4 px-6 py-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end'>
            <input type='hidden' name='developmentId' value={selectedDevelopment.id} />
            <input type='hidden' name='view' value='summary' />
            <label className='block'>
              <span className='mb-2 block text-xs font-semibold uppercase text-muted'>De</span>
              <input type='date' name='dueFrom' defaultValue={formatDateInput(dueFrom ?? defaultSummaryFrom)} className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary' />
            </label>
            <label className='block'>
              <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Ate</span>
              <input type='date' name='dueTo' defaultValue={formatDateInput(dueTo ?? defaultSummaryTo)} className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary' />
            </label>
            <button type='submit' className='rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary-strong'>Aplicar periodo</button>
          </form>
          {monthlyRows.length === 0 ? (
            <p className='px-6 py-12 text-center text-sm text-muted'>Nenhuma movimentacao encontrada no periodo.</p>
          ) : (
            <div className='overflow-x-auto'>
              <table className='min-w-full divide-y divide-border'>
                <thead className='bg-surface-secondary'>
                  <tr>
                    <th className='table-head px-6 py-4 text-left'>Mes</th>
                    <th className='table-head px-6 py-4 text-right'>Previsto</th>
                    <th className='table-head px-6 py-4 text-right'>Recebido</th>
                    <th className='table-head px-6 py-4 text-right'>Em aberto</th>
                    <th className='table-head px-6 py-4 text-right'>Vencido</th>
                    <th className='table-head px-6 py-4 text-right'>Parcelas</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-border'>
                  {monthlyRows.map((row) => (
                    <tr key={monthKey(row.month)} className='hover:bg-surface-secondary/70'>
                      <td className='px-6 py-4 font-semibold text-foreground'><Link href={`/finance?developmentId=${selectedDevelopment.id}&view=calendar&month=${monthKey(row.month)}`} className='hover:text-primary'>{monthLabel(row.month)}</Link></td>
                      <td className='whitespace-nowrap px-6 py-4 text-right text-sm'>{formatCurrency(row.expected)}</td>
                      <td className='whitespace-nowrap px-6 py-4 text-right text-sm font-semibold text-emerald-700'>{formatCurrency(row.received)}</td>
                      <td className='whitespace-nowrap px-6 py-4 text-right text-sm'>{formatCurrency(row.open)}</td>
                      <td className={`whitespace-nowrap px-6 py-4 text-right text-sm ${row.overdue > 0 ? 'font-semibold text-red-700' : ''}`}>{formatCurrency(row.overdue)}</td>
                      <td className='whitespace-nowrap px-6 py-4 text-right text-sm text-muted'>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <PaymentOperationsPanel
        connections={connections.map((connection) => ({
          id: connection.id,
          provider: connection.provider,
          environment: connection.environment,
          status: connection.status,
          webhookStatus: connection.webhookStatus,
          lastWebhookAt: connection.lastWebhookAt?.toISOString() ?? null,
          lastRun: connection.reconciliationRuns[0]
            ? {
                status: connection.reconciliationRuns[0].status,
                checkedCount: connection.reconciliationRuns[0].checkedCount,
                divergenceCount: connection.reconciliationRuns[0].divergenceCount,
                resolvedCount: connection.reconciliationRuns[0].resolvedCount,
                startedAt: connection.reconciliationRuns[0].startedAt.toISOString(),
              }
            : null,
        }))}
        failedWebhooks={failedWebhooks}
        pendingDivergences={pendingDivergences}
        canReconcile={canReconcile}
        failedEvents={failedEvents.map((event) => ({
          ...event,
          createdAt: event.createdAt.toISOString(),
        }))}
        divergences={divergences.map((divergence) => ({
          ...divergence,
          createdAt: divergence.createdAt.toISOString(),
        }))}
      />

      {view === 'list' && (
      <section className='panel overflow-hidden'>
        <form action='/finance' className='panel-header grid gap-4 px-6 py-5 lg:grid-cols-[1fr_180px_150px_150px_auto] lg:items-end'>
          <input type='hidden' name='developmentId' value={selectedDevelopment.id} />
          <input type='hidden' name='view' value='list' />
          <label className='block'>
            <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Busca</span>
            <input
              name='search'
              defaultValue={search}
              placeholder='Cliente, email, CPF, lote ou venda...'
              className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
            />
          </label>
          <label className='block'>
            <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Status</span>
            <select
              name='status'
              defaultValue={status}
              className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
            >
              <option value='open'>Em aberto</option>
              <option value='overdue'>Vencidas</option>
              <option value='upcoming'>A vencer</option>
              <option value='paid'>Pagas</option>
              <option value='all'>Todas</option>
            </select>
          </label>
          <label className='block'>
            <span className='mb-2 block text-xs font-semibold uppercase text-muted'>De</span>
            <input
              type='date'
              name='dueFrom'
              defaultValue={params?.dueFrom ?? ''}
              className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
            />
          </label>
          <label className='block'>
            <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Ate</span>
            <input
              type='date'
              name='dueTo'
              defaultValue={params?.dueTo ?? ''}
              className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
            />
          </label>
          <div className='flex gap-2'>
            <button type='submit' className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong'>
              Filtrar
            </button>
            <Link href={`/finance?developmentId=${selectedDevelopment.id}&view=list`} className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'>
              Limpar
            </Link>
          </div>
        </form>

        {receivables.length === 0 ? (
          <div className='px-6 py-12 text-center'>
            <h2 className='text-base font-semibold text-foreground'>Nenhum recebivel encontrado</h2>
            <p className='mx-auto mt-2 max-w-xl text-sm leading-6 text-muted'>
              Ajuste os filtros ou crie uma venda parcelada para gerar a agenda financeira automaticamente.
            </p>
            <div className='mt-6 flex flex-col justify-center gap-3 sm:flex-row'>
              <Link href={`/finance?developmentId=${selectedDevelopment.id}&view=list`} className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'>
                Limpar filtros
              </Link>
              <Link href={`/sales?developmentId=${selectedDevelopment.id}`} className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong'>
                Criar venda
              </Link>
            </div>
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='min-w-full divide-y divide-border'>
              <thead className='bg-surface-secondary'>
                <tr>
                  <th className='table-head px-6 py-4 text-left'>Cliente</th>
                  <th className='table-head px-6 py-4 text-left'>Venda</th>
                  <th className='table-head px-6 py-4 text-left'>Vencimento</th>
                  <th className='table-head px-6 py-4 text-left'>Valor</th>
                  <th className='table-head px-6 py-4 text-left'>Status</th>
                  <th className='table-head px-6 py-4 text-right'>Acao</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border bg-surface'>
                {receivables.map((receivable) => {
                  const statusMeta = getStatusMeta(receivable)
                  return (
                    <tr key={receivable.id} className='transition hover:bg-surface-secondary/70'>
                      <td className='px-6 py-4'>
                        <p className='text-sm font-semibold text-foreground'>{receivable.sale.user.name}</p>
                        <p className='mt-1 text-xs text-muted'>{receivable.sale.user.email}</p>
                      </td>
                      <td className='px-6 py-4'>
                        <p className='text-sm font-semibold text-foreground'>{getReceivableLabel(receivable)}</p>
                        <p className='mt-1 text-xs text-muted'>
                          Quadra {receivable.sale.lot.block.identifier}, Lote {receivable.sale.lot.identifier}
                        </p>
                      </td>
                      <td className='whitespace-nowrap px-6 py-4 text-sm text-muted'>{formatDate(receivable.dueDate)}</td>
                      <td className='whitespace-nowrap px-6 py-4'>
                        <p className='text-sm font-semibold text-foreground'>{formatCurrency(Number(receivable.amount))}</p>
                        {Number(receivable.paidAmount) > 0 && (
                          <p className='mt-1 text-xs text-muted'>Pago {formatCurrency(Number(receivable.paidAmount))}</p>
                        )}
                        {receivable.paidAt && <p className='mt-1 text-xs font-semibold text-emerald-700'>Em {formatDate(receivable.paidAt)}</p>}
                      </td>
                      <td className='whitespace-nowrap px-6 py-4'>
                        <span className={`pill ${statusMeta.className}`}>{statusMeta.label}</span>
                        {receivable.externalCharges[0] && (
                          <p className='mt-2 text-xs text-muted'>
                            {receivable.externalCharges[0].connection.provider === 'inter' ? 'Inter' : 'Asaas'}: {receivable.externalCharges[0].status}
                            {receivable.externalCharges[0].version > 1 ? ` · v${receivable.externalCharges[0].version}` : ''}
                          </p>
                        )}
                        {receivable.notes && <p className='mt-2 max-w-xs truncate text-xs text-muted'>{receivable.notes}</p>}
                      </td>
                      <td className='whitespace-nowrap px-6 py-4 text-right'>
                        <ReceivableActions
                          canManagePayments={canManagePayments}
                          receivable={{
                            id: receivable.id,
                            kind: receivable.kind,
                            dueDate: receivable.dueDate.toISOString(),
                            amount: Number(receivable.amount),
                            balance: Number(receivable.balance),
                            paidAmount: Number(receivable.paidAmount),
                            status: receivable.status,
                            notes: receivable.notes,
                            hasActiveCharge: Boolean(receivable.externalCharges[0] && !['cancelled', 'refunded'].includes(receivable.externalCharges[0].status)),
                          }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}
    </div>
  )
}
