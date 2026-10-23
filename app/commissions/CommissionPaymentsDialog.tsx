'use client'

import { useState } from 'react'
import { bahiaDate } from '@/lib/payment-dates'

type Payment = { id: string; amount: number; paidAt: string }
type Props = { commission: { id: string; user: { name: string }; payments: Payment[] }; onClose: () => void; onSaved: () => Promise<void> }
const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const date = (value: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia' }).format(new Date(value))

export default function CommissionPaymentsDialog({ commission, onClose, onSaved }: Props) {
  const [editing, setEditing] = useState<Payment | null>(null)
  const [paidAt, setPaidAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const save = async () => {
    if (!editing) return
    setSaving(true); setError(''); setSuccess('')
    try {
      const response = await fetch(`/api/commissions/${commission.id}/payments/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paidAt, previousPaidAt: editing.paidAt }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Não foi possível alterar a data.')
      setEditing(null); setSuccess('Data do pagamento atualizada.'); await onSaved()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro ao salvar.') }
    finally { setSaving(false) }
  }
  return <div role='dialog' aria-modal='true' aria-labelledby='commission-payments-title' className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4'>
    <div className='max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-surface p-6 shadow-2xl'>
      <h2 id='commission-payments-title' className='text-xl font-bold text-foreground'>Pagamentos da comissão</h2>
      <p className='mt-1 text-sm text-muted'>{commission.user.name}</p>
      {error && <p role='alert' className='mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700'>{error}</p>}
      {success && <p role='status' className='mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700'>{success}</p>}
      <div className='mt-4 divide-y divide-border'>{commission.payments.map((payment) => <div key={payment.id} className='space-y-3 py-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'><div><p className='font-semibold text-foreground'>{money(Number(payment.amount))}</p><p className='mt-1 text-sm text-muted'>Pix em {date(payment.paidAt)}</p></div><button type='button' disabled={saving} onClick={() => { setEditing(payment); setPaidAt(bahiaDate(new Date(payment.paidAt))); setError(''); setSuccess('') }} className='rounded-xl border border-border px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50'>Alterar data do pagamento</button></div>
        {editing?.id === payment.id && <form className='flex flex-wrap items-end gap-2' onSubmit={(event) => { event.preventDefault(); void save() }}><label className='flex-1'><span className='mb-2 block text-xs font-semibold text-muted'>Data de pagamento</span><input type='date' required max={bahiaDate()} value={paidAt} onChange={(event) => setPaidAt(event.target.value)} disabled={saving} className='w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground' /></label><button type='submit' disabled={saving || !paidAt} className='rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50'>{saving ? 'Salvando...' : 'Salvar data'}</button><button type='button' disabled={saving} onClick={() => setEditing(null)} className='rounded-xl border border-border px-3 py-2 text-sm font-semibold'>Cancelar</button></form>}
      </div>)}</div>
      <p className='mt-2 text-xs text-muted'>A alteração preserva o valor pago. Fechamentos de sócios já confirmados mantêm seus valores e sinalizam a mudança na origem.</p>
      <div className='mt-5 flex justify-end'><button type='button' disabled={saving} onClick={onClose} className='rounded-xl border border-border px-4 py-2 text-sm font-semibold'>Fechar</button></div>
    </div>
  </div>
}
