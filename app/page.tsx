import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/auth'
import { membershipWhere } from '@/lib/access-control'
import { prisma } from '@/lib/prisma'
import DevelopmentSelector from './components/DevelopmentSelector'

type HomeProps = {
  searchParams?: Promise<{
    developmentId?: string
  }>
}

type MonthlyPoint = {
  key: string
  label: string
  sales: number
  received: number
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString('pt-BR')
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function buildMonthlySeries() {
  const now = new Date()
  const series: MonthlyPoint[] = []

  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    series.push({
      key: getMonthKey(date),
      label: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      sales: 0,
      received: 0,
    })
  }

  return series
}

export default async function Home({ searchParams }: HomeProps) {
  const session = await getCurrentSession()
  if (!session?.user?.id) redirect('/signin')

  const params = await searchParams
  const developments = await prisma.development.findMany({
    where: membershipWhere(session.user.id),
    include: { company: true, settings: true },
    orderBy: { name: 'asc' },
  })

  const selectedDevelopment =
    developments.find((development) => development.id === params?.developmentId) ?? developments[0] ?? null

  if (!selectedDevelopment) {
    return (
      <div className='space-y-6'>
        <div>
          <h1 className='page-title'>Dashboard</h1>
          <p className='page-subtitle'>Crie um empreendimento para acompanhar os indicadores comerciais e financeiros.</p>
        </div>
        <section className='panel px-6 py-10 text-center'>
          <h2 className='text-lg font-semibold text-foreground'>Nenhum empreendimento acessivel</h2>
          <p className='mx-auto mt-2 max-w-xl text-sm leading-6 text-muted'>
            O dashboard depende de um empreendimento com quadras, lotes e permissoes configuradas.
          </p>
          <Link href='/onboarding' className='mt-6 inline-flex rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong'>
            Abrir onboarding
          </Link>
        </section>
      </div>
    )
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const alertLimitDate = new Date(today)
  alertLimitDate.setDate(alertLimitDate.getDate() + 3)

  const [lots, sales, receivables, expiringReservations] = await Promise.all([
    prisma.lot.findMany({
      where: { block: { developmentId: selectedDevelopment.id } },
      select: {
        id: true,
        status: true,
        price: true,
      },
    }),
    prisma.sale.findMany({
      where: { lot: { block: { developmentId: selectedDevelopment.id } } },
      include: {
        user: true,
        lot: { include: { block: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.receivable.findMany({
      where: { sale: { lot: { block: { developmentId: selectedDevelopment.id } } } },
      include: {
        sale: {
          include: {
            user: true,
            lot: { include: { block: true } },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.reservation.findMany({
      where: {
        lot: { block: { developmentId: selectedDevelopment.id } },
        status: { not: 'cancelled' },
        cancelledAt: null,
        sale: null,
        expiresAt: {
          gte: today,
          lte: alertLimitDate,
        },
      },
      include: {
        user: true,
        lot: { include: { block: true } },
      },
      orderBy: { expiresAt: 'asc' },
      take: 5,
    }),
  ])

  const lotMetrics = lots.reduce(
    (acc, lot) => {
      acc.total += 1
      acc.vgv += lot.price
      if (lot.status === 'sold') acc.sold += 1
      else if (lot.status === 'reserved') acc.reserved += 1
      else if (lot.status === 'on_hold') acc.blocked += 1
      else acc.available += 1
      return acc
    },
    { total: 0, sold: 0, reserved: 0, available: 0, blocked: 0, vgv: 0 },
  )

  const financialMetrics = receivables.reduce(
    (acc, receivable) => {
      acc.expected += receivable.amount
      acc.received += receivable.paidAmount
      if (receivable.status !== 'paid') acc.open += receivable.balance
      if (receivable.status !== 'paid' && receivable.dueDate < today) {
        acc.overdueAmount += receivable.balance
        acc.overdueCount += 1
      }
      return acc
    },
    { expected: 0, received: 0, open: 0, overdueAmount: 0, overdueCount: 0 },
  )

  const soldValue = sales.reduce((sum, sale) => sum + sale.totalValue, 0)
  const conversionRate = lotMetrics.total > 0 ? lotMetrics.sold / lotMetrics.total : 0
  const defaultRate = financialMetrics.open > 0 ? financialMetrics.overdueAmount / financialMetrics.open : 0

  const monthlySeries = buildMonthlySeries()
  const monthlyByKey = new Map(monthlySeries.map((point) => [point.key, point]))

  sales.forEach((sale) => {
    const point = monthlyByKey.get(getMonthKey(sale.createdAt))
    if (point) point.sales += sale.totalValue
  })

  receivables.forEach((receivable) => {
    if (!receivable.paidAt) return
    const point = monthlyByKey.get(getMonthKey(receivable.paidAt))
    if (point) point.received += receivable.paidAmount
  })

  const maxMonthlyValue = Math.max(1, ...monthlySeries.flatMap((point) => [point.sales, point.received]))
  const overdueReceivables = receivables
    .filter((receivable) => receivable.status !== 'paid' && receivable.dueDate < today)
    .slice(0, 5)
  const settingsIncomplete =
    !selectedDevelopment.settings ||
    !selectedDevelopment.settings.paymentMethods ||
    selectedDevelopment.settings.maxInstallments <= 0 ||
    selectedDevelopment.settings.minDownPaymentPercentage < 0
  const actionAlerts = [
    ...(settingsIncomplete
      ? [{
          title: 'Revise as configuracoes comerciais',
          description: 'Defina formas de pagamento, entrada minima, juros e prazo maximo antes de escalar vendas.',
          href: '/developments',
          tone: 'amber' as const,
        }]
      : []),
    ...(lotMetrics.total === 0
      ? [{
          title: 'Cadastre quadras e lotes',
          description: 'O empreendimento ainda nao tem estoque para o time comercial consultar.',
          href: '/onboarding',
          tone: 'amber' as const,
        }]
      : []),
    ...(lotMetrics.total > 0 && lotMetrics.available === 0
      ? [{
          title: 'Sem lotes disponiveis',
          description: 'Libere ou cadastre novos lotes para manter o funil de venda ativo.',
          href: '/lots',
          tone: 'red' as const,
        }]
      : []),
    ...(financialMetrics.overdueCount > 0
      ? [{
          title: `${financialMetrics.overdueCount} parcela(s) vencida(s)`,
          description: `${formatCurrency(financialMetrics.overdueAmount)} em aberto exige acompanhamento financeiro.`,
          href: '/finance?status=overdue',
          tone: 'red' as const,
        }]
      : []),
    ...(expiringReservations.length > 0
      ? [{
          title: `${expiringReservations.length} reserva(s) vencem em ate 3 dias`,
          description: 'Priorize contato com os clientes antes de liberar os lotes.',
          href: '/lots?status=reserved',
          tone: 'amber' as const,
        }]
      : []),
  ]

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='page-title'>Dashboard</h1>
          <p className='page-subtitle'>Resumo executivo de estoque, vendas e recebiveis do empreendimento.</p>
        </div>
        <DevelopmentSelector
          selectedDevelopmentId={selectedDevelopment.id}
          developments={developments.map((development) => ({
            id: development.id,
            name: development.name,
            companyName: development.company.name,
          }))}
        />
      </div>

      <section className='panel overflow-hidden'>
        <div className='panel-header px-6 py-5'>
          <div>
            <div className='flex items-end justify-between gap-4'>
              <div>
                <p className='text-xs font-semibold uppercase text-muted'>Lotes vendidos</p>
                <p className='mt-1 text-3xl font-bold text-primary'>{formatPercent(conversionRate)}</p>
              </div>
              <p className='pb-1 text-sm font-semibold text-muted'>{lotMetrics.sold} de {lotMetrics.total} lotes</p>
            </div>
            <div className='mt-4 h-3 overflow-hidden rounded-full bg-surface-secondary'>
              <div className='h-full rounded-full bg-primary' style={{ width: `${conversionRate * 100}%` }} />
            </div>
          </div>
        </div>
        <div className='grid gap-4 px-6 py-6 sm:grid-cols-2 xl:grid-cols-4'>
          <div className='metric-card px-5 py-4'>
            <p className='metric-label'>Lotes totais</p>
            <p className='metric-value'>{lotMetrics.total}</p>
          </div>
          <div className='metric-card px-5 py-4'>
            <p className='metric-label'>Vendidos</p>
            <p className='metric-value text-emerald-700'>{lotMetrics.sold}</p>
          </div>
          <div className='metric-card px-5 py-4'>
            <p className='metric-label'>Reservados</p>
            <p className='metric-value text-amber-700'>{lotMetrics.reserved}</p>
          </div>
          <div className='metric-card px-5 py-4'>
            <p className='metric-label'>Disponiveis</p>
            <p className='metric-value'>{lotMetrics.available}</p>
          </div>
        </div>
      </section>

      {actionAlerts.length > 0 && (
        <section className='panel overflow-hidden'>
          <div className='panel-header px-6 py-5'>
            <h2 className='text-lg font-semibold text-foreground'>Pendencias e proximos passos</h2>
            <p className='mt-1 text-sm text-muted'>Alertas objetivos para manter a operacao comercial e financeira em dia.</p>
          </div>
          <div className='grid gap-4 px-6 py-6 lg:grid-cols-2'>
            {actionAlerts.map((alert) => (
              <Link
                key={alert.title}
                href={alert.href}
                className={`rounded-2xl border px-5 py-4 transition hover:bg-surface-secondary ${
                  alert.tone === 'red' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}
              >
                <p className='text-sm font-semibold'>{alert.title}</p>
                <p className='mt-1 text-sm leading-6 opacity-80'>{alert.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-5'>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>VGV total</p>
          <p className='metric-value'>{formatCurrency(lotMetrics.vgv)}</p>
        </div>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Valor vendido</p>
          <p className='metric-value'>{formatCurrency(soldValue)}</p>
        </div>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Recebido</p>
          <p className='metric-value text-emerald-700'>{formatCurrency(financialMetrics.received)}</p>
        </div>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>A receber</p>
          <p className='metric-value'>{formatCurrency(financialMetrics.open)}</p>
        </div>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Inadimplencia</p>
          <p className={`metric-value ${financialMetrics.overdueAmount > 0 ? 'text-red-700' : ''}`}>
            {formatPercent(defaultRate)}
          </p>
        </div>
      </section>

      <section className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]'>
        <div className='panel overflow-hidden'>
          <div className='panel-header px-6 py-5'>
            <h2 className='text-lg font-semibold text-foreground'>Evolucao mensal</h2>
            <p className='mt-1 text-sm text-muted'>
              Vendido mostra contratos fechados no mes. Recebido soma entradas e parcelas marcadas como pagas no mes.
            </p>
            <div className='mt-4 flex flex-wrap gap-3 text-xs font-semibold text-muted'>
              <span className='inline-flex items-center gap-2'><span className='h-2.5 w-2.5 rounded-full bg-primary' />Vendido no mes</span>
              <span className='inline-flex items-center gap-2'><span className='h-2.5 w-2.5 rounded-full bg-emerald-500' />Recebido no mes</span>
            </div>
          </div>
          <div className='space-y-4 px-6 py-6'>
            {monthlySeries.map((point) => (
              <div key={point.key} className='grid gap-3 md:grid-cols-[72px_minmax(0,1fr)] md:items-center'>
                <p className='text-sm font-semibold capitalize text-foreground'>{point.label}</p>
                <div className='space-y-2'>
                  <div>
                    <div className='mb-1 flex justify-between text-xs font-medium text-muted'>
                      <span>Vendido</span>
                      <span>{formatCurrency(point.sales)}</span>
                    </div>
                    <div className='h-3 overflow-hidden rounded-full bg-surface-secondary'>
                      <div className='h-full rounded-full bg-primary' style={{ width: `${(point.sales / maxMonthlyValue) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className='mb-1 flex justify-between text-xs font-medium text-muted'>
                      <span>Recebido</span>
                      <span>{formatCurrency(point.received)}</span>
                    </div>
                    <div className='h-3 overflow-hidden rounded-full bg-surface-secondary'>
                      <div className='h-full rounded-full bg-emerald-500' style={{ width: `${(point.received / maxMonthlyValue) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className='panel overflow-hidden'>
          <div className='panel-header px-6 py-5'>
            <h2 className='text-lg font-semibold text-foreground'>Vencidos</h2>
            <p className='mt-1 text-sm text-muted'>
              {financialMetrics.overdueCount} parcelas somando {formatCurrency(financialMetrics.overdueAmount)}.
            </p>
          </div>
          <div className='divide-y divide-border'>
            {overdueReceivables.length === 0 ? (
              <div className='px-6 py-10 text-center text-sm text-muted'>Nenhuma parcela vencida no empreendimento.</div>
            ) : (
              overdueReceivables.map((receivable) => (
                <div key={receivable.id} className='px-6 py-4'>
                  <div className='flex items-start justify-between gap-4'>
                    <div>
                      <p className='text-sm font-semibold text-foreground'>{receivable.sale.user.name}</p>
                      <p className='mt-1 text-xs text-muted'>
                        Quadra {receivable.sale.lot.block.identifier}, Lote {receivable.sale.lot.identifier}
                      </p>
                    </div>
                    <span className='pill bg-red-50 text-red-700'>{formatCurrency(receivable.balance)}</span>
                  </div>
                  <p className='mt-2 text-xs text-muted'>Vencimento em {formatDate(receivable.dueDate)}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>

      <section className='panel overflow-hidden'>
        <div className='panel-header flex items-center justify-between px-6 py-5'>
          <div>
            <h2 className='text-lg font-semibold text-foreground'>Ultimas vendas</h2>
            <p className='mt-1 text-sm text-muted'>Contratos mais recentes do empreendimento selecionado.</p>
          </div>
          <Link href='/sales' className='text-sm font-semibold text-primary'>
            Ver vendas
          </Link>
        </div>
        {sales.length === 0 ? (
          <div className='px-6 py-10 text-center text-sm text-muted'>Nenhuma venda registrada para este empreendimento.</div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='min-w-full divide-y divide-border'>
              <thead className='bg-surface-secondary'>
                <tr>
                  <th className='table-head px-6 py-4 text-left'>Cliente</th>
                  <th className='table-head px-6 py-4 text-left'>Lote</th>
                  <th className='table-head px-6 py-4 text-left'>Valor</th>
                  <th className='table-head px-6 py-4 text-left'>Data</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border bg-surface'>
                {sales.slice(0, 6).map((sale) => (
                  <tr key={sale.id} className='transition hover:bg-surface-secondary/70'>
                    <td className='px-6 py-4 text-sm font-semibold text-foreground'>{sale.user.name}</td>
                    <td className='px-6 py-4 text-sm text-muted'>Quadra {sale.lot.block.identifier}, Lote {sale.lot.identifier}</td>
                    <td className='px-6 py-4 text-sm font-semibold text-foreground'>{formatCurrency(sale.totalValue)}</td>
                    <td className='px-6 py-4 text-sm text-muted'>{formatDate(sale.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
