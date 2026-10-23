import { resolveWorkspaceScope, scopedDevelopmentIds } from '@/lib/workspace'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentSession } from '@/lib/auth'
import { membershipWhere, financialDevelopmentAccessWhere } from '@/lib/access-control'
import { prisma } from '@/lib/prisma'
import { getUserPermissions } from '@/lib/permissions'

type HomeProps = {
  searchParams?: Promise<{
    developmentId?: string
    chooseDevelopment?: string
  }>
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

export default async function Home({ searchParams }: HomeProps) {
  const session = await getCurrentSession()
  if (!session?.user?.id) redirect('/signin')
  const access = await getUserPermissions(session.user.id)
  const salesOnly = access.permissions.sales &&
    !access.permissions.admin &&
    !access.permissions.manageSettings &&
    !access.permissions.manageUsers &&
    !access.permissions.finance

  const params = await searchParams
  const developments = await prisma.development.findMany({
    where: salesOnly ? membershipWhere(session.user.id) : financialDevelopmentAccessWhere(session.user.id),
    include: { company: true, settings: true, map: true },
    orderBy: { name: 'asc' },
  })

  if (salesOnly) {
    const preference = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { lastDevelopmentId: true },
    })
    const requestedDevelopment = developments.find((development) => development.id === params?.developmentId)
    const lastDevelopment = developments.find((development) => development.id === preference?.lastDevelopmentId)
    const automaticDevelopment = requestedDevelopment ?? lastDevelopment ?? (developments.length === 1 ? developments[0] : null)

    if (automaticDevelopment && params?.chooseDevelopment !== '1') {
      redirect(`/lots?developmentId=${automaticDevelopment.id}&view=${automaticDevelopment.map ? 'plan' : 'map'}`)
    }

    const lots = await prisma.lot.findMany({
      where: { block: { developmentId: { in: developments.map((development) => development.id) } } },
      select: { status: true, price: true, block: { select: { developmentId: true } } },
    })

    return (
      <div className='mx-auto max-w-6xl space-y-6'>
        <div>
          <p className='text-xs font-semibold uppercase tracking-[0.2em] text-primary'>Area comercial</p>
          <h1 className='page-title mt-2'>Escolha um empreendimento</h1>
          <p className='page-subtitle'>Abra a planta para consultar lotes, simular condicoes e iniciar uma reserva.</p>
        </div>

        {developments.length === 0 ? (
          <section className='panel px-6 py-12 text-center'>
            <h2 className='text-lg font-semibold text-foreground'>Nenhum empreendimento acessivel</h2>
            <p className='mt-2 text-sm text-muted'>Solicite ao administrador acesso a um empreendimento.</p>
          </section>
        ) : (
          <section className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
            {developments.map((development) => {
              const developmentLots = lots.filter((lot) => lot.block.developmentId === development.id)
              const available = developmentLots.filter((lot) => lot.status === 'available').length
              const prices = developmentLots.map((lot) => Number(lot.price)).filter((price) => price > 0)
              const minimumPrice = prices.length > 0 ? Math.min(...prices) : null
              const isLast = development.id === preference?.lastDevelopmentId

              return (
                <Link
                  key={development.id}
                  href={`/lots?developmentId=${development.id}&view=${development.map ? 'plan' : 'map'}`}
                  className='group flex min-h-[240px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:scale-[0.99]'
                >
                  <div className='flex min-h-28 items-center justify-center bg-gradient-to-br from-primary/12 to-primary/5 p-6'>
                    {development.logo ? (
                      <img src={development.logo} alt='' className='max-h-20 max-w-[75%] object-contain' />
                    ) : (
                      <span className='flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-white'>
                        {development.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className='flex flex-1 flex-col p-5'>
                    <div className='flex items-start justify-between gap-3'>
                      <div>
                        <h2 className='text-lg font-bold text-foreground'>{development.name}</h2>
                        <p className='mt-1 text-sm text-muted'>{development.company.name}</p>
                      </div>
                      {isLast && <span className='pill shrink-0 bg-primary/10 text-primary'>Ultimo acesso</span>}
                    </div>
                    <div className='mt-5 grid grid-cols-2 gap-3 text-sm'>
                      <div className='rounded-xl bg-emerald-50 px-3 py-3'>
                        <p className='text-xs font-semibold text-emerald-700'>Disponiveis</p>
                        <p className='mt-1 text-xl font-bold text-emerald-800'>{available}</p>
                      </div>
                      <div className='rounded-xl bg-surface-secondary px-3 py-3'>
                        <p className='text-xs font-semibold text-muted'>A partir de</p>
                        <p className='mt-1 text-sm font-bold text-foreground'>{minimumPrice === null ? 'Consulte' : formatCurrency(minimumPrice)}</p>
                      </div>
                    </div>
                    <span className='mt-5 inline-flex items-center justify-between text-sm font-semibold text-primary'>
                      {development.map ? 'Abrir planta' : 'Consultar lotes'}
                      <span aria-hidden='true' className='transition group-hover:translate-x-1'>→</span>
                    </span>
                  </div>
                </Link>
              )
            })}
          </section>
        )}
      </div>
    )
  }

  if (!access.permissions.manageSettings && !access.permissions.finance) redirect('/lots')

  const developmentScope = resolveWorkspaceScope(params?.developmentId, developments.map((item) => item.id))
  const scopeIds = scopedDevelopmentIds(developmentScope, developments.map((item) => item.id))
  const scopedDevelopments = developments.filter((item) => scopeIds.includes(item.id))
  if (!scopeIds.length) {
    return (
      <div className='space-y-6'>
        <div>
          <h1 className='page-title'>Painel</h1>
          <p className='page-subtitle'>Crie um empreendimento para acompanhar os indicadores comerciais e financeiros.</p>
        </div>
        <section className='panel px-6 py-10 text-center'>
          <h2 className='text-lg font-semibold text-foreground'>Nenhum empreendimento acessivel</h2>
          <p className='mx-auto mt-2 max-w-xl text-sm leading-6 text-muted'>
            O dashboard depende de um empreendimento com quadras, lotes e permissoes configuradas.
          </p>
          <Link href='/developments' className='mt-6 inline-flex rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong'>
            Criar empreendimento
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
      where: { block: { developmentId: { in: scopeIds } } },
      select: {
        id: true,
        status: true,
        price: true,
      },
    }),
    prisma.sale.findMany({
      where: { lot: { block: { developmentId: { in: scopeIds } } } },
      include: {
        user: true,
        lot: { include: { block: { include: { development: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.receivable.findMany({
      where: { sale: { lot: { block: { developmentId: { in: scopeIds } } } } },
      include: {
        sale: {
          include: {
            user: true,
            lot: { include: { block: { include: { development: { select: { name: true } } } } } },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.reservation.findMany({
      where: {
        lot: { block: { developmentId: { in: scopeIds } } },
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
        lot: { include: { block: { include: { development: { select: { name: true } } } } } },
      },
      orderBy: { expiresAt: 'asc' },
      take: 5,
    }),
  ])

  const lotMetrics = lots.reduce(
    (acc, lot) => {
      acc.total += 1
      acc.vgv += Number(lot.price)
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
      acc.expected += Number(receivable.amount)
      acc.received += Number(receivable.paidAmount)
      if (receivable.status !== 'paid') acc.open += Number(receivable.balance)
      if (receivable.status !== 'paid' && receivable.dueDate < today) {
        acc.overdueAmount += Number(receivable.balance)
        acc.overdueCount += 1
      }
      return acc
    },
    { expected: 0, received: 0, open: 0, overdueAmount: 0, overdueCount: 0 },
  )

  const soldValue = sales.reduce((sum, sale) => sum + Number(sale.totalValue), 0)
  const conversionRate = lotMetrics.total > 0 ? lotMetrics.sold / lotMetrics.total : 0
  const defaultRate = financialMetrics.open > 0 ? financialMetrics.overdueAmount / financialMetrics.open : 0
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const currentMonthSalesCount = sales.filter((sale) => sale.createdAt >= currentMonthStart).length
  const previousMonthSalesCount = sales.filter((sale) => sale.createdAt >= previousMonthStart && sale.createdAt < currentMonthStart).length
  const salesMonthDelta = currentMonthSalesCount - previousMonthSalesCount
  const salesMonthDeltaLabel =
    salesMonthDelta === 0 ? 'estavel vs. mes anterior' : `${salesMonthDelta > 0 ? '+' : ''}${salesMonthDelta} vs. mes anterior`
  const salesMonthDeltaTone = salesMonthDelta > 0 ? 'text-emerald-700' : salesMonthDelta < 0 ? 'text-red-700' : 'text-muted'

  const overdueReceivables = receivables
    .filter((receivable) => receivable.status !== 'paid' && receivable.dueDate < today)
    .slice(0, 5)
  const settingsIncomplete = scopedDevelopments.some((item) => !item.settings || !item.settings.paymentMethods || item.settings.maxInstallments <= 0 || item.settings.minDownPaymentPercentage < 0)
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
          href: '/developments',
          tone: 'amber' as const,
        }]
      : []),
    ...(lotMetrics.total > 0 && lotMetrics.available === 0
      ? [{
          title: 'Sem lotes disponiveis',
          description: 'Libere ou cadastre novos lotes para manter o funil de venda ativo.',
          href: `/lots?developmentId=${developmentScope}`,
          tone: 'red' as const,
        }]
      : []),
    ...(financialMetrics.overdueCount > 0
      ? [{
          title: `${financialMetrics.overdueCount} parcela(s) vencida(s)`,
          description: `${formatCurrency(financialMetrics.overdueAmount)} em aberto exige acompanhamento financeiro.`,
          href: `/finance?developmentId=${developmentScope}&status=overdue`,
          tone: 'red' as const,
        }]
      : []),
    ...(expiringReservations.length > 0
      ? [{
          title: `${expiringReservations.length} reserva(s) vencem em ate 3 dias`,
          description: 'Priorize contato com os clientes antes de liberar os lotes.',
          href: `/lots?developmentId=${developmentScope}&status=reserved`,
          tone: 'amber' as const,
        }]
      : []),
  ]

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='page-title'>Painel</h1>
          <p className='page-subtitle'>Resumo executivo de estoque, vendas e recebiveis do empreendimento.</p>
        </div>
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

      <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-6'>
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
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Vendas no mes</p>
          <p className='metric-value'>{currentMonthSalesCount}</p>
          <p className={`mt-1 text-xs font-semibold ${salesMonthDeltaTone}`}>{salesMonthDeltaLabel}</p>
        </div>
      </section>

      <section>
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
                        {receivable.sale.lot.block.development?.name} · Quadra {receivable.sale.lot.block.identifier}, Lote {receivable.sale.lot.identifier}
                      </p>
                    </div>
                    <span className='pill bg-red-50 text-red-700'>{formatCurrency(Number(receivable.balance))}</span>
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
          <Link href={`/sales?developmentId=${developmentScope}`} className='text-sm font-semibold text-primary'>
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
                    <td className='px-6 py-4 text-sm text-muted'>{sale.lot.block.development?.name} · Quadra {sale.lot.block.identifier}, Lote {sale.lot.identifier}</td>
                    <td className='px-6 py-4 text-sm font-semibold text-foreground'>{formatCurrency(Number(sale.totalValue))}</td>
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
