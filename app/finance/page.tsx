import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/auth'
import { membershipWhere } from '@/lib/access-control'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/app/generated/prisma'
import { hasAnyDevelopmentPermission, hasDevelopmentPermission } from '@/lib/permissions'
import ReceivableActions from './components/ReceivableActions'

type FinancePageProps = {
  searchParams?: Promise<{
    developmentId?: string
    status?: string
    search?: string
    dueFrom?: string
    dueTo?: string
  }>
}

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
  const status = params?.status || 'open'
  const search = params?.search?.trim() || ''
  const dueFrom = parseDateOnly(params?.dueFrom)
  const dueTo = parseDateOnly(params?.dueTo)
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
          <Link href='/onboarding' className='mt-6 inline-flex rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong'>
            Abrir onboarding
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
    },
    orderBy: [
      { dueDate: 'asc' },
      { sequence: 'asc' },
    ],
  })

  const summary = receivables.reduce(
    (acc, receivable) => {
      acc.expected += receivable.amount
      acc.received += receivable.paidAmount
      if (receivable.status !== 'paid') acc.open += receivable.balance
      if (receivable.status !== 'paid' && receivable.dueDate < today) {
        acc.overdue += receivable.balance
        acc.overdueCount += 1
      }
      if (receivable.status === 'paid') acc.paidCount += 1
      return acc
    },
    { expected: 0, received: 0, open: 0, overdue: 0, overdueCount: 0, paidCount: 0 },
  )

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='page-title'>Financeiro</h1>
          <p className='page-subtitle'>Localize parcelas, acompanhe vencidos e registre baixas de pagamento.</p>
        </div>
        <Link href='/sales' className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'>
          Ver vendas
        </Link>
      </div>

      <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-5'>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Previsto</p>
          <p className='metric-value'>{formatCurrency(summary.expected)}</p>
        </div>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Recebido</p>
          <p className='metric-value text-emerald-700'>{formatCurrency(summary.received)}</p>
        </div>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>A receber</p>
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

      <section className='panel overflow-hidden'>
        <form action='/finance' className='panel-header grid gap-4 px-6 py-5 lg:grid-cols-[1fr_180px_180px_150px_150px_auto] lg:items-end'>
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
            <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Empreendimento</span>
            <select
              name='developmentId'
              defaultValue={selectedDevelopment.id}
              className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
            >
              {developments.map((development) => (
                <option key={development.id} value={development.id}>
                  {development.name}
                </option>
              ))}
            </select>
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
            <Link href='/finance' className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'>
              Limpar
            </Link>
          </div>
        </form>

        {receivables.length === 0 ? (
          <div className='px-6 py-12 text-center'>
            <h2 className='text-base font-semibold text-foreground'>Nenhum recebivel encontrado</h2>
            <p className='mt-2 text-sm text-muted'>Ajuste os filtros ou crie uma venda com parcelas para alimentar o financeiro.</p>
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
                        <p className='text-sm font-semibold text-foreground'>{formatCurrency(receivable.amount)}</p>
                        {receivable.paidAmount > 0 && (
                          <p className='mt-1 text-xs text-muted'>Pago {formatCurrency(receivable.paidAmount)}</p>
                        )}
                      </td>
                      <td className='whitespace-nowrap px-6 py-4'>
                        <span className={`pill ${statusMeta.className}`}>{statusMeta.label}</span>
                        {receivable.notes && <p className='mt-2 max-w-xs truncate text-xs text-muted'>{receivable.notes}</p>}
                      </td>
                      <td className='whitespace-nowrap px-6 py-4 text-right'>
                        <ReceivableActions
                          receivable={{
                            id: receivable.id,
                            amount: receivable.amount,
                            balance: receivable.balance,
                            paidAmount: receivable.paidAmount,
                            status: receivable.status,
                            notes: receivable.notes,
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
    </div>
  )
}
