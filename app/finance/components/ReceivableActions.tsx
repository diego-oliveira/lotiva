'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type ReceivableActionsProps = {
  canManagePayments: boolean
  receivable: {
    id: string
    kind?: string
    dueDate: string
    amount: number
    balance: number
    paidAmount: number
    status: string
    notes?: string | null
    hasActiveCharge?: boolean
  }
}

type Dialog = 'payment' | 'dueDate' | 'chargeDueDate' | null

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function defaultChargeDueDate() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return formatDateInput(tomorrow)
}

export default function ReceivableActions({ canManagePayments, receivable }: ReceivableActionsProps) {
  const router = useRouter()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [paidAt, setPaidAt] = useState(formatDateInput(new Date()))
  const [dueDate, setDueDate] = useState(formatDateInput(new Date(receivable.dueDate)))
  const [dueDateScope, setDueDateScope] = useState<'single' | 'following'>('single')
  const [chargeDueDate, setChargeDueDate] = useState(defaultChargeDueDate())

  if (!canManagePayments) return null

  const closeDialog = () => {
    if (saving) return
    setDialog(null)
    setError(null)
  }

  const updateReceivable = async (body: Record<string, unknown>, successMessage: string) => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(`/api/receivables/${receivable.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.details || payload.error || 'Nao foi possivel atualizar a parcela.')
      setDialog(null)
      setSuccess(successMessage)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel atualizar a parcela.')
    } finally {
      setSaving(false)
    }
  }

  const markAsPaid = () => updateReceivable({
    status: 'paid',
    paidAmount: receivable.amount,
    paidAt,
    notes: receivable.notes,
  }, 'Parcela marcada como paga.')

  const reopen = () => updateReceivable({ status: 'pending', notes: receivable.notes }, 'Parcela reaberta.')

  const changeDueDate = () => updateReceivable(
    { dueDate, scope: dueDateScope },
    dueDateScope === 'following' ? 'Vencimento desta parcela e das seguintes atualizado.' : 'Vencimento atualizado.',
  )

  const issueCharge = async (newChargeDueDate?: string) => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(`/api/receivables/${receivable.id}/charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingType: 'BOLETO',
          ...(newChargeDueDate ? { chargeDueDate: newChargeDueDate } : {}),
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.details || payload.error || 'Nao foi possivel gerar o boleto.')
      setDialog(null)
      setSuccess(payload.alreadyComplete ? 'O boleto desta parcela ja havia sido gerado.' : 'Boleto gerado com sucesso.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel gerar o boleto.')
    } finally {
      setSaving(false)
    }
  }

  const startIssueCharge = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const originalDueDate = parseDateInput(formatDateInput(new Date(receivable.dueDate)))
    if (originalDueDate < today) {
      setChargeDueDate(defaultChargeDueDate())
      setError(null)
      setDialog('chargeDueDate')
      return
    }
    void issueCharge()
  }

  return (
    <div className='space-y-2'>
      {error && !dialog && <p className='rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700'>{error}</p>}
      {success && <p className='rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700'>{success}</p>}

      <div className='flex flex-col gap-2'>
        {receivable.status === 'paid' ? (
          <button type='button' onClick={() => void reopen()} disabled={saving} className='rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-secondary disabled:opacity-60'>
            {saving ? 'Salvando...' : 'Reabrir parcela'}
          </button>
        ) : (
          <>
            <button type='button' onClick={() => { setPaidAt(formatDateInput(new Date())); setError(null); setDialog('payment') }} disabled={saving} className='rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-strong disabled:opacity-60'>
              Marcar como paga
            </button>
            <button type='button' onClick={() => { setDueDate(formatDateInput(new Date(receivable.dueDate))); setDueDateScope('single'); setError(null); setDialog('dueDate') }} disabled={saving} className='rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/8 disabled:opacity-60'>
              Alterar vencimento
            </button>
            {!receivable.hasActiveCharge && (
              <button type='button' onClick={startIssueCharge} disabled={saving} className='rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/8 disabled:opacity-60'>
                {saving ? 'Gerando...' : receivable.kind === 'down_payment' ? 'Gerar boleto da entrada' : 'Gerar boleto'}
              </button>
            )}
          </>
        )}
      </div>

      {dialog && (
        <div className='fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 px-4'>
          <div className='w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl'>
            <div className='border-b border-border px-5 py-4'>
              <h3 className='text-base font-semibold text-foreground'>
                {dialog === 'payment' ? 'Registrar pagamento' : dialog === 'dueDate' ? 'Alterar vencimento' : 'Novo vencimento do boleto'}
              </h3>
              <p className='mt-1 text-sm text-muted'>
                {dialog === 'chargeDueDate' ? 'A parcela esta vencida. Informe uma data futura para o novo boleto.' : 'Confirme os dados antes de continuar.'}
              </p>
            </div>

            <div className='space-y-4 px-5 py-5'>
              {error && <div className='rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>{error}</div>}

              {dialog === 'payment' && (
                <label className='block'>
                  <span className='mb-2 block text-sm font-semibold text-foreground'>Data de pagamento</span>
                  <input type='date' value={paidAt} onChange={(event) => setPaidAt(event.target.value)} className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary' />
                </label>
              )}

              {dialog === 'dueDate' && (
                <>
                  <label className='block'>
                    <span className='mb-2 block text-sm font-semibold text-foreground'>Novo vencimento</span>
                    <input type='date' value={dueDate} onChange={(event) => setDueDate(event.target.value)} className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary' />
                  </label>
                  <fieldset className='space-y-2'>
                    <legend className='mb-2 text-sm font-semibold text-foreground'>Aplicar alteracao</legend>
                    <label className='flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3'>
                      <input type='radio' name={`due-date-scope-${receivable.id}`} checked={dueDateScope === 'single'} onChange={() => setDueDateScope('single')} className='mt-1' />
                      <span><span className='block text-sm font-semibold text-foreground'>Somente esta parcela</span><span className='text-xs text-muted'>As demais datas permanecem iguais.</span></span>
                    </label>
                    <label className='flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3'>
                      <input type='radio' name={`due-date-scope-${receivable.id}`} checked={dueDateScope === 'following'} onChange={() => setDueDateScope('following')} className='mt-1' />
                      <span><span className='block text-sm font-semibold text-foreground'>Esta e as seguintes</span><span className='text-xs text-muted'>As proximas parcelas serao reorganizadas mensalmente.</span></span>
                    </label>
                  </fieldset>
                  <p className='rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'>Boletos ativos tambem terao o vencimento atualizado no provedor.</p>
                </>
              )}

              {dialog === 'chargeDueDate' && (
                <label className='block'>
                  <span className='mb-2 block text-sm font-semibold text-foreground'>Vencimento para cobranca</span>
                  <input type='date' min={formatDateInput(new Date())} value={chargeDueDate} onChange={(event) => setChargeDueDate(event.target.value)} className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary' />
                </label>
              )}
            </div>

            <div className='flex justify-end gap-3 border-t border-border px-5 py-4'>
              <button type='button' onClick={closeDialog} disabled={saving} className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground disabled:opacity-60'>Cancelar</button>
              <button
                type='button'
                onClick={() => dialog === 'payment' ? void markAsPaid() : dialog === 'dueDate' ? void changeDueDate() : void issueCharge(chargeDueDate)}
                disabled={saving || (dialog === 'payment' && !paidAt) || (dialog === 'dueDate' && !dueDate) || (dialog === 'chargeDueDate' && !chargeDueDate)}
                className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60'
              >
                {saving ? 'Salvando...' : dialog === 'payment' ? 'Confirmar pagamento' : dialog === 'dueDate' ? 'Alterar vencimento' : 'Gerar boleto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
