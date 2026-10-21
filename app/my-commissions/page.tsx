'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import CommissionProgress from '@/app/components/CommissionProgress'

type Commission = {
  id: string
  amount: number
  percentage: number
  releasedAmount: number
  availableAmount: number
  status: string
  payments: { id: string; amount: number; paidAt: string }[]
  sale: { user: { name: string }; lot: { identifier: string; block: { identifier: string; development: { name: string } } } }
}

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const date = (value: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia' }).format(new Date(value))
const labels: Record<string, string> = {
  waiting_entry: 'Aguardando entrada', partially_released: 'Liberada parcialmente',
  released: 'Liberada', partially_paid: 'Recebida parcialmente', paid: 'Recebida',
}

function MyCommissionsContent() {
  const searchParams = useSearchParams()
  const developmentId = searchParams.get('developmentId') ?? ''
  const [items, setItems] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ scope: 'mine' })
    if (developmentId) params.set('developmentId', developmentId)
    void (async () => {
      try {
        const response = await fetch(`/api/commissions?${params}`, { cache: 'no-store', signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar suas comissões.')
        setItems(data)
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Erro ao carregar suas comissões.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()
    return () => controller.abort()
  }, [developmentId, retry])

  const totals = useMemo(() => items.reduce((result, item) => {
    result.total += Number(item.amount)
    result.available += Number(item.availableAmount)
    result.waiting += Math.max(0, Number(item.amount) - Number(item.releasedAmount))
    result.paid += item.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    return result
  }, { total: 0, available: 0, waiting: 0, paid: 0 }), [items])
  const visibleItems = items.filter((item) => !status || item.status === status)

  return <div className='space-y-6'>
    <div>
      <p className='eyebrow'>Meu desempenho</p>
      <h1 className='page-title'>Minhas comissões</h1>
      <p className='page-subtitle'>Acompanhe quanto você tem para receber e os pagamentos de cada venda.</p>
    </div>
    {loading ? <div role='status' aria-label='Carregando comissões' className='h-60 animate-pulse rounded-2xl bg-surface-secondary' /> : error ? (
      <div role='alert' className='rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700'>
        <p>{error}</p>
        <button onClick={() => setRetry((value) => value + 1)} className='mt-3 font-semibold underline'>Tentar novamente</button>
      </div>
    ) : <>
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        {[
          { label: 'Disponível para receber', value: totals.available, highlight: true },
          { label: 'A liberar', value: totals.waiting },
          { label: 'Recebido', value: totals.paid },
          { label: 'Comissão total', value: totals.total },
        ].map((card) => <div key={card.label} className={`rounded-2xl border p-5 ${card.highlight ? 'border-emerald-200 bg-emerald-50' : 'border-border bg-surface'}`}>
          <p className={`text-sm ${card.highlight ? 'text-emerald-800' : 'text-muted'}`}>{card.label}</p>
          <p className={`mt-2 text-2xl font-bold ${card.highlight ? 'text-emerald-700' : 'text-foreground'}`}>{money(card.value)}</p>
        </div>)}
      </div>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div><h2 className='text-lg font-semibold text-foreground'>Comissões por venda</h2><p className='mt-1 text-sm text-muted'>Abra uma venda para conferir os pagamentos recebidos. A entrada paga libera sua comissão proporcionalmente.</p></div>
        <select aria-label='Filtrar comissões por status' value={status} onChange={(event) => setStatus(event.target.value)} className='rounded-xl border border-border bg-surface px-4 py-3 text-sm'>
          <option value=''>Todos os status</option>
          {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {visibleItems.length === 0 ? <div className='rounded-2xl border border-border bg-surface p-10 text-center text-sm text-muted'>
        {items.length === 0 ? 'Você ainda não tem comissões neste empreendimento. Suas comissões aparecerão aqui quando forem vinculadas às vendas.' : 'Nenhuma comissão com este status.'}
      </div> : <div className='space-y-3'>
        {visibleItems.map((item) => {
          const paid = item.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
          return <details key={item.id} className='group overflow-hidden rounded-2xl border border-border bg-surface'>
            <summary className='cursor-pointer list-none p-5 marker:content-none [&::-webkit-details-marker]:hidden'>
              <div className='flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between'>
                <div className='min-w-0 flex-1'>
                  <div className='flex flex-wrap items-center gap-2'><h3 className='font-semibold text-foreground'>{item.sale.user.name}</h3><span className='rounded-full bg-surface-secondary px-2.5 py-1 text-xs font-medium text-muted'>{labels[item.status] ?? item.status}</span></div>
                  <p className='mt-1 text-sm text-muted'>{item.sale.lot.block.development.name} · Quadra {item.sale.lot.block.identifier}, Lote {item.sale.lot.identifier}</p>
                </div>
                <div className='w-full lg:w-[420px] lg:shrink-0'>
                  <CommissionProgress compact wrapSummary paidLabel='Recebido' percentage={Number(item.percentage)} amount={Number(item.amount)} releasedAmount={Number(item.releasedAmount)} paidAmount={paid} availableAmount={Number(item.availableAmount)} />
                </div>
                <span className='flex items-center gap-2 text-xs font-medium text-muted lg:ml-2'><span>Pagamentos ({item.payments.length})</span><svg aria-hidden='true' className='h-4 w-4 transition-transform group-open:rotate-180' viewBox='0 0 24 24' fill='none' stroke='currentColor'><path d='m6 9 6 6 6-6' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' /></svg></span>
              </div>
            </summary>
            <div className='border-t border-border px-5 py-4'>
              <h4 className='text-sm font-semibold text-foreground'>Pagamentos recebidos</h4>
              {item.payments.length === 0 ? <p className='mt-2 text-sm text-muted'>Nenhum pagamento registrado até o momento.</p> : <ul className='mt-2 divide-y divide-border'>
                {item.payments.map((payment) => <li key={payment.id} className='flex items-center justify-between gap-4 py-3 text-sm'><span className='text-muted'>Pix · {date(payment.paidAt)}</span><span className='font-semibold text-emerald-700'>{money(Number(payment.amount))}</span></li>)}
              </ul>}
            </div>
          </details>
        })}
      </div>}
    </>}
  </div>
}

export default function MyCommissionsPage() {
  return <Suspense fallback={<div className='h-60 animate-pulse rounded-2xl bg-surface-secondary' />}><MyCommissionsContent /></Suspense>
}
