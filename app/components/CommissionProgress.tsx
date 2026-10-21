'use client'

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

export default function CommissionProgress({
  percentage,
  amount,
  releasedAmount,
  paidAmount,
  availableAmount,
  compact = false,
  wrapSummary = false,
  paidLabel = 'Pago',
}: {
  percentage: number
  amount: number
  releasedAmount: number
  paidAmount: number
  availableAmount: number
  compact?: boolean
  wrapSummary?: boolean
  paidLabel?: string
}) {
  const safeAmount = Math.max(0, Number(amount))
  const released = Math.min(safeAmount, Math.max(0, Number(releasedAmount)))
  const paid = Math.max(0, Number(paidAmount))
  const available = Math.max(0, Number(availableAmount))
  const pendingRelease = Math.max(0, safeAmount - released)
  const progress = safeAmount > 0 ? Math.min(100, released / safeAmount * 100) : 0

  return (
    <div className={compact && !wrapSummary ? 'min-w-[300px]' : ''}>
      <div className='flex items-baseline justify-between gap-3'>
        <span className='text-xs font-medium text-muted'>Comissão total</span>
        <span className='font-semibold text-foreground'>{percentage.toLocaleString('pt-BR')}% · {money(safeAmount)}</span>
      </div>
      <div className={`${compact ? 'mt-2' : 'mt-3'} h-2 overflow-hidden rounded-full bg-surface-secondary`} aria-label={`${progress.toFixed(0)}% da comissão liberada`}>
        <div className='h-full rounded-full bg-primary transition-all' style={{ width: `${progress}%` }} />
      </div>
      {!compact && <div className='mt-2 flex justify-between gap-3 text-xs text-muted'>
        <span>Liberado pela entrada</span>
        <span className='font-semibold text-foreground'>{money(released)} de {money(safeAmount)}</span>
      </div>}
      {compact ? (
        <dl className={`mt-2 flex items-baseline gap-x-2 gap-y-1 text-xs text-muted ${wrapSummary ? 'flex-wrap' : 'whitespace-nowrap'}`}>
          <div className='flex gap-1 whitespace-nowrap'><dt>{paidLabel}</dt><dd className='font-semibold text-foreground'>{money(paid)}</dd></div>
          <div className='flex gap-1 whitespace-nowrap'><dt><span aria-hidden='true' className='mr-2'>·</span>Disponível</dt><dd className={`font-semibold ${available > 0 ? 'text-emerald-700' : 'text-foreground'}`}>{money(available)}</dd></div>
          <div className='flex gap-1 whitespace-nowrap'><dt><span aria-hidden='true' className='mr-2'>·</span>A liberar</dt><dd className='font-semibold text-foreground'>{money(pendingRelease)}</dd></div>
        </dl>
      ) : <dl className='mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3'>
        <div><dt className='text-xs text-muted'>Pago</dt><dd className='mt-1 text-sm font-semibold text-foreground'>{money(paid)}</dd></div>
        <div><dt className='text-xs text-muted'>Disponível agora</dt><dd className={`mt-1 text-sm font-semibold ${available > 0 ? 'text-emerald-700' : 'text-foreground'}`}>{money(available)}</dd></div>
        <div><dt className='text-xs text-muted'>A liberar</dt><dd className='mt-1 text-sm font-semibold text-foreground'>{money(pendingRelease)}</dd></div>
      </dl>}
    </div>
  )
}
