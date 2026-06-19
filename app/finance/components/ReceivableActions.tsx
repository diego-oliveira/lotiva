'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type ReceivableActionsProps = {
  canManagePayments: boolean
  receivable: {
    id: string
    amount: number
    balance: number
    paidAmount: number
    status: string
    notes?: string | null
  }
}

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function ReceivableActions({ canManagePayments, receivable }: ReceivableActionsProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paidAmount, setPaidAmount] = useState(String(receivable.balance || receivable.amount))
  const [paidAt, setPaidAt] = useState(formatDateInput(new Date()))
  const [notes, setNotes] = useState(receivable.notes ?? '')

  if (!canManagePayments) return null

  const updateReceivable = async (status: 'paid' | 'pending') => {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/receivables/${receivable.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          paidAmount: Number(paidAmount),
          paidAt,
          notes,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Nao foi possivel atualizar o recebivel.')
      }

      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel atualizar o recebivel.')
    } finally {
      setSaving(false)
    }
  }

  if (receivable.status === 'paid') {
    return (
      <button
        type='button'
        onClick={() => updateReceivable('pending')}
        disabled={saving}
        className='rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-secondary disabled:opacity-60'
      >
        {saving ? 'Salvando...' : 'Reabrir'}
      </button>
    )
  }

  return (
    <>
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-strong'
      >
        Dar baixa
      </button>

      {open && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4'>
          <div className='w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl'>
            <div className='border-b border-border px-5 py-4'>
              <h3 className='text-base font-semibold text-foreground'>Registrar pagamento</h3>
              <p className='mt-1 text-sm text-muted'>Informe os dados da baixa desta parcela.</p>
            </div>
            <div className='space-y-4 px-5 py-5'>
              {error && (
                <div className='rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>{error}</div>
              )}
              <label className='block'>
                <span className='mb-2 block text-sm font-semibold text-foreground'>Valor pago</span>
                <input
                  type='number'
                  step='0.01'
                  min='0.01'
                  value={paidAmount}
                  onChange={(event) => setPaidAmount(event.target.value)}
                  className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                />
              </label>
              <label className='block'>
                <span className='mb-2 block text-sm font-semibold text-foreground'>Data de pagamento</span>
                <input
                  type='date'
                  value={paidAt}
                  onChange={(event) => setPaidAt(event.target.value)}
                  className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                />
              </label>
              <label className='block'>
                <span className='mb-2 block text-sm font-semibold text-foreground'>Observacao</span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                />
              </label>
            </div>
            <div className='flex justify-end gap-3 border-t border-border px-5 py-4'>
              <button
                type='button'
                onClick={() => setOpen(false)}
                disabled={saving}
                className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary disabled:opacity-60'
              >
                Cancelar
              </button>
              <button
                type='button'
                onClick={() => updateReceivable('paid')}
                disabled={saving}
                className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-60'
              >
                {saving ? 'Salvando...' : 'Confirmar baixa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
