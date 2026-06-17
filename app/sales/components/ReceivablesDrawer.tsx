'use client'

import { useEffect, useMemo, useState } from 'react'

interface Receivable {
  id: string
  kind: string
  sequence: number
  dueDate: string
  amount: number
  paidAmount: number
  balance: number
  status: string
  paidAt?: string | null
}

interface Sale {
  id: string
  totalValue: number
  annualAdjustment: boolean
  user: {
    name: string
    email: string
  }
  lot: {
    identifier: string
    block: {
      identifier: string
    }
  }
  receivables?: Receivable[]
}

interface ReceivablesDrawerProps {
  sale: Sale | null
  isOpen: boolean
  canManagePayments: boolean
  canCancelPayments: boolean
  canApproveAdjustments: boolean
  onClose: () => void
  onUpdated: () => Promise<void>
}

interface ExternalCharge {
  id: string
  receivableId: string
  providerChargeId: string
  billingType: string
  status: string
  amount: number
  dueDate: string
  invoiceUrl: string | null
  bankSlipUrl: string | null
  pixPayload: string | null
  version: number
  cancellationReason: string | null
  grossPaidAmount: number | null
  netPaidAmount: number | null
  feeAmount: number | null
  providerPaymentDate: string | null
}

interface AdjustmentReview {
  id: string
  cycleNumber: number
  indexName: string
  percentage: number
  source: string
  reason: string
  status: string
  rejectionReason: string | null
  createdAt: string
  createdBy: { name: string }
  reviewedBy: { name: string } | null
  connection: { environment: string; provider: string }
  items: Array<{
    id: string
    previousAmount: number
    adjustedAmount: number
    receivable: { sequence: number; dueDate: string }
  }>
}

interface BillingCycle {
  id: string
  cycleNumber: number
  startSequence: number
  endSequence: number
  status: string
  issuedAt: string | null
  connection: {
    provider: string
    environment: string
    status: string
  }
  externalCharges: ExternalCharge[]
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value).replace(/\u00A0/g, ' ')
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('pt-BR')
}

function isOverdue(receivable: Receivable) {
  if (receivable.status === 'paid') return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDate = new Date(receivable.dueDate)
  dueDate.setHours(0, 0, 0, 0)
  return dueDate < today
}

function getReceivableLabel(receivable: Receivable) {
  if (receivable.kind === 'down_payment') return 'Entrada'
  return `Parcela ${receivable.sequence}`
}

function getStatusMeta(receivable: Receivable) {
  if (receivable.status === 'paid') {
    return { label: 'Paga', className: 'bg-emerald-50 text-emerald-700' }
  }

  if (isOverdue(receivable)) {
    return { label: 'Vencida', className: 'bg-red-50 text-red-700' }
  }

  return { label: 'Em aberto', className: 'bg-amber-50 text-amber-700' }
}

function getChargeMeta(charge?: ExternalCharge) {
  if (!charge) return { label: 'Boleto nao gerado', className: 'bg-slate-100 text-slate-600' }
  if (charge.status === 'received' || charge.status === 'confirmed') {
    return { label: 'Pago pelo boleto', className: 'bg-emerald-50 text-emerald-700' }
  }
  if (charge.status === 'overdue') {
    return { label: 'Boleto vencido', className: 'bg-red-50 text-red-700' }
  }
  if (charge.status === 'cancelled') {
    return { label: 'Boleto cancelado', className: 'bg-slate-100 text-slate-600' }
  }
  if (charge.status === 'refunded') {
    return { label: 'Pagamento estornado', className: 'bg-amber-50 text-amber-700' }
  }
  return { label: 'Boleto gerado', className: 'bg-blue-50 text-blue-700' }
}

export default function ReceivablesDrawer({
  sale,
  isOpen,
  canManagePayments,
  canCancelPayments,
  canApproveAdjustments,
  onClose,
  onUpdated,
}: ReceivablesDrawerProps) {
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cycles, setCycles] = useState<BillingCycle[]>([])
  const [cyclesLoading, setCyclesLoading] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [cycleSuccess, setCycleSuccess] = useState<string | null>(null)
  const [adjustments, setAdjustments] = useState<AdjustmentReview[]>([])
  const [adjustmentsLoading, setAdjustmentsLoading] = useState(false)
  const [adjustmentSaving, setAdjustmentSaving] = useState(false)
  const [adjustmentForm, setAdjustmentForm] = useState({
    indexName: 'INCC',
    percentage: '',
    source: '',
    reason: '',
  })
  const [chargeActionId, setChargeActionId] = useState<string | null>(null)

  const loadCycles = async () => {
    if (!sale || !canManagePayments) return

    setCyclesLoading(true)
    try {
      const response = await fetch(`/api/sales/${sale.id}/billing-cycles`, { cache: 'no-store' })
      const payload = await response.json().catch(() => [])
      if (!response.ok) {
        throw new Error(payload.error || 'Nao foi possivel carregar as cobrancas Asaas.')
      }
      setCycles(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel carregar as cobrancas Asaas.')
    } finally {
      setCyclesLoading(false)
    }
  }

  const loadAdjustments = async () => {
    if (!sale || !canManagePayments) return
    setAdjustmentsLoading(true)
    try {
      const response = await fetch(`/api/sales/${sale.id}/adjustments`, { cache: 'no-store' })
      const payload = await response.json().catch(() => [])
      if (!response.ok) throw new Error(payload.error || 'Nao foi possivel carregar os reajustes.')
      setAdjustments(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel carregar os reajustes.')
    } finally {
      setAdjustmentsLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen || !sale) return
    setError(null)
    setCycleSuccess(null)
    setCycles([])
    setAdjustments([])
    void loadCycles()
    void loadAdjustments()
  }, [isOpen, sale?.id, canManagePayments])

  const receivables = sale?.receivables ?? []
  const summary = useMemo(() => {
    return receivables.reduce(
      (acc, receivable) => {
        acc.total += receivable.amount
        acc.paid += receivable.paidAmount
        acc.balance += receivable.balance
        if (isOverdue(receivable)) acc.overdue += 1
        return acc
      },
      { total: 0, paid: 0, balance: 0, overdue: 0 },
    )
  }, [receivables])
  const chargesByReceivable = useMemo(() => {
    const map = new Map<string, ExternalCharge>()
    cycles
      .flatMap((cycle) => cycle.externalCharges)
      .sort((left, right) => right.version - left.version)
      .forEach((charge) => {
        if (!map.has(charge.receivableId)) map.set(charge.receivableId, charge)
      })
    return map
  }, [cycles])

  if (!isOpen || !sale) return null

  const issueBillingCycle = async () => {
    setIssuing(true)
    setError(null)
    setCycleSuccess(null)
    try {
      const response = await fetch(`/api/sales/${sale.id}/billing-cycles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycleSize: 12,
          billingType: 'BOLETO',
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.details || payload.error || 'Nao foi possivel emitir as cobrancas.')
      }

      setCycleSuccess(
        payload.alreadyComplete
          ? 'Os boletos deste ciclo ja tinham sido gerados.'
          : `${payload.charges?.length ?? 0} boleto(s) gerado(s) com sucesso.`,
      )
      await loadCycles()
      await onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel emitir as cobrancas.')
    } finally {
      setIssuing(false)
    }
  }

  const createAdjustment = async () => {
    setAdjustmentSaving(true)
    setError(null)
    setCycleSuccess(null)
    try {
      const response = await fetch(`/api/sales/${sale.id}/adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustmentForm),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Nao foi possivel criar o reajuste.')
      setAdjustmentForm({ indexName: 'INCC', percentage: '', source: '', reason: '' })
      setCycleSuccess('Reajuste enviado para aprovacao.')
      await loadAdjustments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel criar o reajuste.')
    } finally {
      setAdjustmentSaving(false)
    }
  }

  const reviewAdjustment = async (reviewId: string, action: 'approve' | 'reject') => {
    const rejectionReason = action === 'reject'
      ? window.prompt('Informe o motivo da rejeicao:')
      : null
    if (action === 'reject' && !rejectionReason?.trim()) return

    setAdjustmentSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/sales/${sale.id}/adjustments/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejectionReason }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Nao foi possivel analisar o reajuste.')
      setCycleSuccess(action === 'approve' ? 'Reajuste aprovado e aplicado.' : 'Reajuste rejeitado.')
      await loadAdjustments()
      await onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel analisar o reajuste.')
    } finally {
      setAdjustmentSaving(false)
    }
  }

  const runChargeAction = async (charge: ExternalCharge, action: 'cancel' | 'reissue') => {
    const reason = window.prompt(
      action === 'cancel'
        ? 'Informe o motivo do cancelamento:'
        : 'Informe o motivo da reemissao:',
    )
    if (!reason?.trim()) return

    setChargeActionId(charge.id)
    setError(null)
    try {
      const response = await fetch(`/api/external-charges/${charge.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Nao foi possivel alterar a cobranca.')
      setCycleSuccess(action === 'cancel' ? 'Cobranca cancelada.' : 'Cobranca reemitida.')
      await loadCycles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel alterar a cobranca.')
    } finally {
      setChargeActionId(null)
    }
  }

  const updateReceivable = async (receivable: Receivable, status: 'paid' | 'pending') => {
    setSavingId(receivable.id)
    setError(null)

    try {
      const response = await fetch(`/api/receivables/${receivable.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Nao foi possivel atualizar a parcela.')
      }

      await onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel atualizar a parcela.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <>
      <button
        type='button'
        aria-label='Fechar agenda financeira'
        onClick={onClose}
        className='fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px] lg:left-[290px]'
      />
      <aside className='fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl flex-col border-l border-border bg-surface shadow-2xl'>
        <div className='border-b border-border px-6 py-5'>
          <div className='flex items-start justify-between gap-4'>
            <div>
              <p className='text-xs font-semibold uppercase text-muted'>Agenda financeira</p>
              <h2 className='mt-1 text-xl font-semibold text-foreground'>{sale.user.name}</h2>
              <p className='mt-1 text-sm text-muted'>
                Quadra {sale.lot.block.identifier}, Lote {sale.lot.identifier} - {formatCurrency(sale.totalValue)}
              </p>
            </div>
            <button
              type='button'
              onClick={onClose}
              className='rounded-xl border border-border bg-surface-secondary p-2 text-muted transition hover:bg-background hover:text-foreground'
              aria-label='Fechar'
            >
              <svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M6 18L18 6M6 6l12 12' />
              </svg>
            </button>
          </div>
        </div>

        <div className='flex-1 overflow-y-auto px-6 py-6'>
          {error && (
            <div className='mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700'>
              {error}
            </div>
          )}
          {cycleSuccess && (
            <div className='mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700'>
              {cycleSuccess}
            </div>
          )}

          <section className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
            <div className='metric-card min-w-0 px-4 py-4'>
              <p className='metric-label'>Total previsto</p>
              <p className='mt-2 break-words text-2xl font-bold leading-8 text-foreground'>{formatCurrency(summary.total)}</p>
            </div>
            <div className='metric-card min-w-0 px-4 py-4'>
              <p className='metric-label'>Recebido</p>
              <p className='mt-2 break-words text-2xl font-bold leading-8 text-emerald-700'>{formatCurrency(summary.paid)}</p>
            </div>
            <div className='metric-card min-w-0 px-4 py-4'>
              <p className='metric-label'>Saldo</p>
              <p className='mt-2 break-words text-2xl font-bold leading-8 text-foreground'>{formatCurrency(summary.balance)}</p>
            </div>
            <div className='metric-card min-w-0 px-4 py-4'>
              <p className='metric-label'>Vencidas</p>
              <p className={`mt-2 break-words text-2xl font-bold leading-8 ${summary.overdue > 0 ? 'text-red-700' : 'text-foreground'}`}>{summary.overdue}</p>
            </div>
          </section>

          {canManagePayments && cyclesLoading && (
            <div className='mt-6 rounded-2xl border border-border bg-surface px-5 py-4 text-sm text-muted'>
              Carregando boletos...
            </div>
          )}

          {canManagePayments && sale.annualAdjustment && cycles.length > 0 && (
            <section className='mt-6 overflow-hidden rounded-2xl border border-border bg-surface'>
              <div className='border-b border-border bg-surface-secondary px-5 py-4'>
                <h3 className='text-base font-semibold text-foreground'>Reajuste anual</h3>
                <p className='mt-1 text-sm text-muted'>O proximo ciclo so pode ser emitido depois da aprovacao.</p>
              </div>

              <div className='grid gap-4 border-b border-border px-5 py-5 md:grid-cols-2'>
                <label>
                  <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Indice</span>
                  <input
                    value={adjustmentForm.indexName}
                    onChange={(event) => setAdjustmentForm((current) => ({ ...current, indexName: event.target.value }))}
                    className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm'
                  />
                </label>
                <label>
                  <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Percentual (%)</span>
                  <input
                    type='number'
                    min='0.0001'
                    step='0.0001'
                    value={adjustmentForm.percentage}
                    onChange={(event) => setAdjustmentForm((current) => ({ ...current, percentage: event.target.value }))}
                    className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm'
                  />
                </label>
                <label>
                  <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Fonte</span>
                  <input
                    value={adjustmentForm.source}
                    onChange={(event) => setAdjustmentForm((current) => ({ ...current, source: event.target.value }))}
                    placeholder='Ex.: FGV, competencia maio/2027'
                    className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm'
                  />
                </label>
                <label>
                  <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Justificativa</span>
                  <input
                    value={adjustmentForm.reason}
                    onChange={(event) => setAdjustmentForm((current) => ({ ...current, reason: event.target.value }))}
                    placeholder='Motivo e referencia do reajuste'
                    className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm'
                  />
                </label>
                <div className='md:col-span-2 flex justify-end'>
                  <button
                    type='button'
                    onClick={createAdjustment}
                    disabled={adjustmentSaving || !adjustmentForm.percentage || !adjustmentForm.source.trim() || !adjustmentForm.reason.trim()}
                    className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60'
                  >
                    {adjustmentSaving ? 'Salvando...' : 'Simular e enviar para aprovacao'}
                  </button>
                </div>
              </div>

              {adjustmentsLoading ? (
                <div className='px-5 py-6 text-sm text-muted'>Carregando reajustes...</div>
              ) : adjustments.length === 0 ? (
                <div className='px-5 py-6 text-sm text-muted'>Nenhum reajuste registrado.</div>
              ) : (
                <div className='divide-y divide-border'>
                  {adjustments.map((review) => (
                    <div key={review.id} className='px-5 py-4'>
                      <div className='flex flex-wrap items-start justify-between gap-3'>
                        <div>
                          <div className='flex flex-wrap items-center gap-2'>
                            <p className='text-sm font-semibold text-foreground'>Ciclo {review.cycleNumber} · {review.indexName} {review.percentage}%</p>
                            <span className={`pill ${review.status === 'applied' ? 'bg-emerald-50 text-emerald-700' : review.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                              {review.status === 'applied' ? 'Aplicado' : review.status === 'rejected' ? 'Rejeitado' : 'Aguardando aprovacao'}
                            </span>
                          </div>
                          <p className='mt-1 text-xs text-muted'>{review.source} · solicitado por {review.createdBy.name}</p>
                          <p className='mt-2 text-sm text-muted'>{review.reason}</p>
                          <p className='mt-2 text-xs text-muted'>
                            {review.items.length} parcela(s), de {formatCurrency(review.items[0]?.previousAmount || 0)} para {formatCurrency(review.items[0]?.adjustedAmount || 0)}
                          </p>
                        </div>
                        {review.status === 'pending' && canApproveAdjustments && (
                          <div className='flex gap-2'>
                            <button
                              type='button'
                              disabled={adjustmentSaving}
                              onClick={() => reviewAdjustment(review.id, 'reject')}
                              className='rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700'
                            >
                              Rejeitar
                            </button>
                            <button
                              type='button'
                              disabled={adjustmentSaving}
                              onClick={() => reviewAdjustment(review.id, 'approve')}
                              className='rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white'
                            >
                              Aprovar e aplicar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className='mt-6 overflow-hidden rounded-2xl border border-border bg-surface'>
            <div className='border-b border-border bg-surface-secondary px-5 py-4'>
              <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
                <div>
                  <h3 className='text-base font-semibold text-foreground'>Parcelas e recebimentos</h3>
                  <p className='mt-1 text-sm text-muted'>
                    Acompanhe cada parcela e veja se o boleto ja foi gerado.
                  </p>
                </div>
                {canManagePayments && (
                  <button
                    type='button'
                    onClick={issueBillingCycle}
                    disabled={issuing}
                    className='rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-60'
                  >
                    {issuing ? 'Gerando...' : 'Gerar boletos das proximas 12'}
                  </button>
                )}
              </div>
            </div>

            {receivables.length === 0 ? (
              <div className='px-5 py-10 text-center text-sm text-muted'>Nenhum recebivel gerado para esta venda.</div>
            ) : (
              <div className='space-y-4 bg-surface-secondary/40 px-5 py-5'>
                {receivables.map((receivable) => {
                  const status = getStatusMeta(receivable)
                  const paid = receivable.status === 'paid'
                  const charge = chargesByReceivable.get(receivable.id)
                  const chargeMeta = getChargeMeta(charge)

                  return (
                    <article key={receivable.id} className='rounded-2xl border border-border bg-surface px-5 py-5 shadow-sm'>
                      <div className='grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(180px,0.7fr)]'>
                        <div className='min-w-0'>
                          <div className='flex flex-wrap items-center gap-2'>
                            <p className='text-base font-semibold text-foreground'>{getReceivableLabel(receivable)}</p>
                            <span className={`pill ${status.className}`}>{status.label}</span>
                          </div>
                          <div className='mt-2 grid gap-3 sm:grid-cols-2'>
                            <div>
                              <p className='text-xs font-semibold uppercase text-muted'>Vencimento</p>
                              <p className='mt-1 text-sm font-medium text-foreground'>{formatDate(receivable.dueDate)}</p>
                            </div>
                            <div>
                              <p className='text-xs font-semibold uppercase text-muted'>Valor</p>
                              <p className='mt-1 text-sm font-semibold text-foreground'>{formatCurrency(receivable.amount)}</p>
                            </div>
                          </div>
                        </div>

                        <div className='rounded-2xl border border-border bg-surface-secondary px-4 py-4'>
                          <p className='text-xs font-semibold uppercase text-muted'>{paid ? 'Pago em' : 'Saldo'}</p>
                          <p className='mt-1 text-lg font-semibold text-foreground'>
                            {paid && receivable.paidAt ? formatDate(receivable.paidAt) : formatCurrency(receivable.balance)}
                          </p>
                        </div>
                      </div>

                      <div className='mt-5 rounded-2xl border border-border px-4 py-4'>
                        <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
                          <div className='min-w-0'>
                            <div className='flex flex-wrap items-center gap-2'>
                              <p className='text-xs font-semibold uppercase text-muted'>Boleto</p>
                              <span className={`pill ${chargeMeta.className}`}>{chargeMeta.label}</span>
                              {charge && charge.version > 1 && <span className='pill bg-slate-100 text-slate-600'>v{charge.version}</span>}
                            </div>
                            {charge?.grossPaidAmount !== null && charge?.grossPaidAmount !== undefined && (
                              <p className='mt-2 text-sm text-muted'>
                                Bruto {formatCurrency(charge.grossPaidAmount)}
                                {charge.feeAmount !== null ? ` · tarifa ${formatCurrency(charge.feeAmount)}` : ''}
                              </p>
                            )}
                            {charge?.cancellationReason && (
                              <p className='mt-2 text-sm text-red-700'>Motivo: {charge.cancellationReason}</p>
                            )}
                          </div>

                          {charge && (
                            <div className='flex flex-wrap gap-2 md:justify-end'>
                              {charge.invoiceUrl && (
                                <a
                                  href={charge.invoiceUrl}
                                  target='_blank'
                                  rel='noreferrer'
                                  className='rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/8'
                                >
                                  Abrir cobranca
                                </a>
                              )}
                              {charge.bankSlipUrl && (
                                <a
                                  href={charge.bankSlipUrl}
                                  target='_blank'
                                  rel='noreferrer'
                                  className='rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/8'
                                >
                                  Boleto
                                </a>
                              )}
                              {charge.pixPayload && (
                                <button
                                  type='button'
                                  onClick={async () => {
                                    await navigator.clipboard.writeText(charge.pixPayload || '')
                                    setCycleSuccess('Codigo PIX copiado.')
                                  }}
                                  className='rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/8'
                                >
                                  Copiar PIX
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className='mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end'>
                        <button
                          type='button'
                          onClick={() => updateReceivable(receivable, paid ? 'pending' : 'paid')}
                          disabled={savingId === receivable.id}
                          className='rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-surface-secondary disabled:opacity-60'
                        >
                          {savingId === receivable.id ? 'Salvando...' : paid ? 'Reabrir parcela' : 'Marcar como paga'}
                        </button>

                        {charge && canCancelPayments && !['confirmed', 'received'].includes(charge.status) && (
                          <button
                            type='button'
                            disabled={chargeActionId === charge.id}
                            onClick={() => runChargeAction(
                              charge,
                              ['cancelled', 'refunded'].includes(charge.status) ? 'reissue' : 'cancel',
                            )}
                            className='rounded-xl border border-red-200 bg-surface px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60'
                          >
                            {chargeActionId === charge.id
                              ? 'Processando...'
                              : ['cancelled', 'refunded'].includes(charge.status)
                                ? 'Reemitir boleto'
                                : 'Cancelar boleto'}
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </aside>
    </>
  )
}
