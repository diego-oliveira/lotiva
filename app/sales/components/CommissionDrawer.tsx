'use client'

import { useEffect, useState } from 'react'
import FormDrawer from '@/app/components/FormDrawer'
import { NumberTextInput } from '@/app/components/NumberTextInput'
import CommissionProgress from '@/app/components/CommissionProgress'

type Broker = { id: string; name: string; email: string }
type Commission = { id: string; percentage: number; amount: number; releasedAmount: number; availableAmount: number; status: string; user: Broker; payments: Array<{ amount: number }> }
type Payload = { sale: { salePrice: number }; defaultPercentage: number; entryPaidPercentage: number; commissions: Commission[]; brokers: Broker[]; canEdit: boolean }
type Allocation = { userId: string; percentage: number }

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const statusLabel: Record<string, string> = { waiting_entry: 'Aguardando entrada', partially_released: 'Liberada parcialmente', released: 'Liberada', partially_paid: 'Paga parcialmente', paid: 'Paga' }

export default function CommissionDrawer({ saleId, isOpen, onClose }: { saleId: string; isOpen: boolean; onClose: () => void }) {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !saleId) return
    setLoading(true); setError('')
    fetch(`/api/sales/${saleId}/commissions`, { cache: 'no-store' })
      .then(async (response) => { if (!response.ok) throw new Error((await response.json()).error || 'Nao foi possivel carregar as comissoes.'); return response.json() })
      .then((data: Payload) => {
        setPayload(data)
        setAllocations(data.commissions.map((item) => ({ userId: item.user.id, percentage: Number(item.percentage) })))
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false))
  }, [isOpen, saleId])

  const totalPercentage = allocations.reduce((sum, item) => sum + Number(item.percentage || 0), 0)
  const addAllocation = () => setAllocations((current) => [...current, { userId: '', percentage: current.length === 0 ? payload?.defaultPercentage ?? 6 : 0 }])
  const save = async () => {
    if (!payload) return
    setSaving(true); setError('')
    try {
      const response = await fetch(`/api/sales/${saleId}/commissions`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ allocations }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Nao foi possivel salvar.')
      setPayload(data)
      setAllocations(data.commissions.map((item: Commission) => ({ userId: item.user.id, percentage: Number(item.percentage) })))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro ao salvar.') } finally { setSaving(false) }
  }

  return (
    <FormDrawer isOpen={isOpen} title='Comissoes da venda' description='Divida a comissao entre os corretores. O valor e congelado com base no valor desta venda.' onClose={onClose}>
      {loading ? <div className='h-32 animate-pulse rounded-2xl bg-surface-secondary' /> : payload && (
        <div className='space-y-5'>
          <div className='grid grid-cols-2 gap-3'>
            <div className='rounded-2xl border border-border bg-surface-secondary p-4'><p className='text-xs text-muted'>Valor da venda</p><p className='mt-1 font-semibold text-foreground'>{money(Number(payload.sale.salePrice))}</p></div>
            <div className='rounded-2xl border border-border bg-surface-secondary p-4'><p className='text-xs text-muted'>Comissao total</p><p className='mt-1 font-semibold text-foreground'>{totalPercentage.toLocaleString('pt-BR')}% · {money(Number(payload.sale.salePrice) * totalPercentage / 100)}</p></div>
          </div>
          {payload.commissions.length > 0 && <div className='space-y-3'>{payload.commissions.map((item) => {
            const paid = item.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
            return <div key={item.id} className='rounded-2xl border border-border p-4'>
              <div className='flex flex-wrap items-start justify-between gap-3'><div><p className='font-semibold text-foreground'>{item.user.name}</p><p className='text-sm text-muted'>{item.user.email}</p></div><span className='h-fit rounded-full bg-surface-secondary px-3 py-1 text-xs font-semibold text-muted'>{statusLabel[item.status] ?? item.status}</span></div>
              <div className='mt-5 border-t border-border pt-4'><CommissionProgress percentage={Number(item.percentage)} amount={Number(item.amount)} releasedAmount={Number(item.releasedAmount)} paidAmount={paid} availableAmount={Number(item.availableAmount)} /></div>
            </div>
          })}</div>}
          {payload.canEdit && <section className='rounded-2xl border border-border p-4'>
            <div className='flex items-center justify-between'><div><h3 className='font-semibold text-foreground'>Divisao</h3><p className='text-sm text-muted'>Padrao do empreendimento: {payload.defaultPercentage}%.</p></div><button type='button' onClick={addAllocation} className='rounded-xl border border-border px-3 py-2 text-sm font-semibold text-primary'>+ Corretor</button></div>
            <div className='mt-4 space-y-3'>{allocations.map((item, index) => <div key={index} className='grid grid-cols-[1fr_110px_auto] gap-2'>
              <select value={item.userId} onChange={(event) => setAllocations((current) => current.map((value, position) => position === index ? { ...value, userId: event.target.value } : value))} className='min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-sm'><option value=''>Selecione</option>{payload.brokers.map((broker) => <option key={broker.id} value={broker.id}>{broker.name}</option>)}</select>
              <div className='relative'><NumberTextInput min={0.01} max={100} step='0.01' value={item.percentage} onValueChange={(value) => setAllocations((current) => current.map((entry, position) => position === index ? { ...entry, percentage: value } : entry))} className='w-full rounded-xl border border-border bg-surface px-3 py-2 pr-7 text-sm' /><span className='absolute right-3 top-2 text-sm text-muted'>%</span></div>
              <button type='button' aria-label='Remover' onClick={() => setAllocations((current) => current.filter((_, position) => position !== index))} className='rounded-xl border border-border px-3 text-red-600'>×</button>
            </div>)}</div>
            {allocations.length === 0 && <button type='button' onClick={addAllocation} className='mt-4 w-full rounded-xl border border-dashed border-primary/40 px-4 py-3 text-sm font-semibold text-primary'>Aplicar comissao padrao</button>}
            <button type='button' onClick={save} disabled={saving || totalPercentage > 100} className='mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50'>{saving ? 'Salvando...' : 'Salvar divisao'}</button>
          </section>}
          {error && <p className='rounded-xl bg-red-50 p-3 text-sm text-red-700'>{error}</p>}
        </div>
      )}
      {!loading && error && !payload && <p className='rounded-xl bg-red-50 p-3 text-sm text-red-700'>{error}</p>}
    </FormDrawer>
  )
}
