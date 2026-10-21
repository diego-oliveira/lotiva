'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import CommissionProgress from '@/app/components/CommissionProgress'

type Payment = { id: string; amount: number; paidAt: string; pixKey?: string | null }
type Commission = {
  id: string
  percentage: number
  amount: number
  status: string
  releasedAt?: string | null
  releasedAmount: number
  availableAmount: number
  user: { name: string; email: string }
  payments: Payment[]
  sale: { user: { name: string }; lot: { identifier: string; block: { identifier: string; development: { id: string; name: string } } } }
}

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const labels: Record<string, string> = { waiting_entry: 'Aguardando entrada', partially_released: 'Liberada parcialmente', released: 'Liberada', partially_paid: 'Paga parcialmente', paid: 'Paga' }
const today = () => new Date().toISOString().slice(0, 10)

function CommissionsContent() {
  const searchParams = useSearchParams()
  const developmentId = searchParams.get('developmentId') ?? ''
  const [items, setItems] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [paying, setPaying] = useState<Commission | null>(null)
  const [form, setForm] = useState({ amount: '', paidAt: today(), pixKey: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      if (developmentId) params.set('developmentId', developmentId)
      if (status) params.set('status', status)
      const response = await fetch(`/api/commissions?${params}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Nao foi possivel carregar as comissoes.')
      setItems(data)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro ao carregar.') } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [developmentId, status]) // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => items.reduce((result, item) => {
    const paid = item.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
    result.total += Number(item.amount); result.paid += paid
    result.available += Number(item.availableAmount)
    result.waiting += Math.max(0, Number(item.amount) - Number(item.releasedAmount))
    return result
  }, { total: 0, paid: 0, available: 0, waiting: 0 }), [items])

  const openPayment = (item: Commission) => {
    setPaying(item); setForm({ amount: Number(item.availableAmount).toFixed(2), paidAt: today(), pixKey: '', notes: '' }); setError('')
  }
  const savePayment = async () => {
    if (!paying) return
    setSaving(true); setError('')
    try {
      const response = await fetch(`/api/commissions/${paying.id}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: Number(form.amount.replace(',', '.')) }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Nao foi possivel registrar o Pix.')
      setPaying(null); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro ao registrar pagamento.') } finally { setSaving(false) }
  }

  return <div className='space-y-6'>
    <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'><div><p className='eyebrow'>Financeiro</p><h1 className='page-title'>Comissoes</h1><p className='page-subtitle'>Cada parcela paga da entrada libera uma parte proporcional da comissao.</p></div><select value={status} onChange={(event) => setStatus(event.target.value)} className='rounded-xl border border-border bg-surface px-4 py-3 text-sm'><option value=''>Todos os status</option><option value='waiting_entry'>Aguardando entrada</option><option value='partially_released'>Liberadas parcialmente</option><option value='released'>Liberadas</option><option value='partially_paid'>Pagas parcialmente</option><option value='paid'>Pagas</option></select></div>
    <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>{[
      ['Comissoes', totals.total], ['Aguardando entrada', totals.waiting], ['Disponivel para pagar', totals.available], ['Pago', totals.paid],
    ].map(([label, value]) => <div key={String(label)} className='rounded-2xl border border-border bg-surface p-5'><p className='text-sm text-muted'>{label}</p><p className='mt-2 text-2xl font-bold text-foreground'>{money(Number(value))}</p></div>)}</div>
    {error && <div className='rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>{error}</div>}
    <div className='overflow-hidden rounded-2xl border border-border bg-surface'>{loading ? <div className='h-40 animate-pulse bg-surface-secondary' /> : items.length === 0 ? <div className='p-10 text-center text-sm text-muted'>Nenhuma comissao encontrada. Configure a divisao na venda.</div> : <div className='overflow-x-auto'><table className='min-w-full divide-y divide-border'><thead className='bg-surface-secondary'><tr><th className='table-head px-5 py-4 text-left'>Corretor</th><th className='table-head px-5 py-4 text-left'>Venda</th><th className='table-head px-5 py-4 text-left'>Comissão</th><th className='table-head px-5 py-4 text-left'>Status</th><th className='table-head px-5 py-4 text-right'>Ação</th></tr></thead><tbody className='divide-y divide-border'>{items.map((item) => {
      const paid = item.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
      return <tr key={item.id} className='align-top'><td className='px-5 py-5'><p className='font-semibold text-foreground'>{item.user.name}</p><p className='text-sm text-muted'>{item.user.email}</p></td><td className='px-5 py-5'><p className='font-medium text-foreground'>{item.sale.user.name}</p><p className='text-sm text-muted'>{item.sale.lot.block.development.name} · Quadra {item.sale.lot.block.identifier}, Lote {item.sale.lot.identifier}</p></td><td className='px-5 py-5'><CommissionProgress compact percentage={Number(item.percentage)} amount={Number(item.amount)} releasedAmount={Number(item.releasedAmount)} paidAmount={paid} availableAmount={Number(item.availableAmount)} /></td><td className='px-5 py-5'><span className='whitespace-nowrap rounded-full bg-surface-secondary px-3 py-1 text-xs font-semibold text-muted'>{labels[item.status] ?? item.status}</span></td><td className='px-5 py-5 text-right'>{Number(item.availableAmount) > 0 && <button onClick={() => openPayment(item)} className='whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white'>Registrar Pix</button>}</td></tr>
    })}</tbody></table></div>}</div>
    {paying && <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4'><div className='w-full max-w-lg rounded-2xl bg-surface p-6 shadow-2xl'><h2 className='text-xl font-bold text-foreground'>Registrar pagamento via Pix</h2><p className='mt-1 text-sm text-muted'>{paying.user.name}</p><div className='mt-5 grid gap-4 sm:grid-cols-2'><label className='block'><span className='mb-2 block text-sm font-semibold'>Valor</span><input value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className='w-full rounded-xl border border-border bg-background px-4 py-3' /></label><label className='block'><span className='mb-2 block text-sm font-semibold'>Data</span><input type='date' value={form.paidAt} onChange={(event) => setForm({ ...form, paidAt: event.target.value })} className='w-full rounded-xl border border-border bg-background px-4 py-3' /></label><label className='block sm:col-span-2'><span className='mb-2 block text-sm font-semibold'>Chave Pix (opcional)</span><input value={form.pixKey} onChange={(event) => setForm({ ...form, pixKey: event.target.value })} className='w-full rounded-xl border border-border bg-background px-4 py-3' /></label><label className='block sm:col-span-2'><span className='mb-2 block text-sm font-semibold'>Observacao (opcional)</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className='w-full rounded-xl border border-border bg-background px-4 py-3' /></label></div><div className='mt-6 flex justify-end gap-3'><button onClick={() => setPaying(null)} className='rounded-xl border border-border px-4 py-3 font-semibold'>Cancelar</button><button onClick={savePayment} disabled={saving} className='rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-50'>{saving ? 'Salvando...' : 'Confirmar pagamento'}</button></div></div></div>}
  </div>
}

export default function CommissionsPage() { return <Suspense fallback={<div className='h-40 animate-pulse rounded-2xl bg-surface-secondary' />}><CommissionsContent /></Suspense> }
