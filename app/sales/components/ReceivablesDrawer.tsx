'use client'

import { useMemo, useState } from 'react'

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
  onClose: () => void
  onUpdated: () => Promise<void>
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
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

export default function ReceivablesDrawer({ sale, isOpen, onClose, onUpdated }: ReceivablesDrawerProps) {
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  if (!isOpen || !sale) return null

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

          <section className='grid gap-4 md:grid-cols-4'>
            <div className='metric-card px-5 py-4'>
              <p className='metric-label'>Total previsto</p>
              <p className='metric-value'>{formatCurrency(summary.total)}</p>
            </div>
            <div className='metric-card px-5 py-4'>
              <p className='metric-label'>Recebido</p>
              <p className='metric-value text-emerald-700'>{formatCurrency(summary.paid)}</p>
            </div>
            <div className='metric-card px-5 py-4'>
              <p className='metric-label'>Saldo</p>
              <p className='metric-value'>{formatCurrency(summary.balance)}</p>
            </div>
            <div className='metric-card px-5 py-4'>
              <p className='metric-label'>Vencidas</p>
              <p className={`metric-value ${summary.overdue > 0 ? 'text-red-700' : ''}`}>{summary.overdue}</p>
            </div>
          </section>

          <section className='mt-6 overflow-hidden rounded-2xl border border-border bg-surface'>
            <div className='border-b border-border bg-surface-secondary px-5 py-4'>
              <h3 className='text-base font-semibold text-foreground'>Parcelas e recebimentos</h3>
            </div>

            {receivables.length === 0 ? (
              <div className='px-5 py-10 text-center text-sm text-muted'>Nenhum recebivel gerado para esta venda.</div>
            ) : (
              <div className='divide-y divide-border'>
                {receivables.map((receivable) => {
                  const status = getStatusMeta(receivable)
                  const paid = receivable.status === 'paid'

                  return (
                    <div key={receivable.id} className='grid gap-4 px-5 py-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center'>
                      <div>
                        <div className='flex flex-wrap items-center gap-2'>
                          <p className='text-sm font-semibold text-foreground'>{getReceivableLabel(receivable)}</p>
                          <span className={`pill ${status.className}`}>{status.label}</span>
                        </div>
                        <p className='mt-1 text-sm text-muted'>Vencimento em {formatDate(receivable.dueDate)}</p>
                      </div>
                      <div>
                        <p className='text-xs font-semibold uppercase text-muted'>Valor</p>
                        <p className='mt-1 text-sm font-semibold text-foreground'>{formatCurrency(receivable.amount)}</p>
                      </div>
                      <div>
                        <p className='text-xs font-semibold uppercase text-muted'>{paid ? 'Pago em' : 'Saldo'}</p>
                        <p className='mt-1 text-sm font-semibold text-foreground'>
                          {paid && receivable.paidAt ? formatDate(receivable.paidAt) : formatCurrency(receivable.balance)}
                        </p>
                      </div>
                      <div className='flex justify-start md:justify-end'>
                        <button
                          type='button'
                          onClick={() => updateReceivable(receivable, paid ? 'pending' : 'paid')}
                          disabled={savingId === receivable.id}
                          className='rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-surface-secondary disabled:opacity-60'
                        >
                          {savingId === receivable.id ? 'Salvando...' : paid ? 'Reabrir' : 'Marcar como paga'}
                        </button>
                      </div>
                    </div>
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
