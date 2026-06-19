'use client'

import { useEffect, useMemo, useState } from 'react'
import FormDrawer from '@/app/components/FormDrawer'

type Development = {
  id: string
  name: string
  metrics?: {
    totalLots: number
    availableLots: number
    reservedLots: number
    soldLots: number
    totalValue: number
  }
}

type LotDraft = {
  identifier: string
  front: number
  back: number
  leftSide: number
  rightSide: number
  totalArea: number
  price: number
  status: string
}

type LotBatchDrawerProps = {
  development: Development | null
  isOpen: boolean
  onClose: () => void
  onSave: (count: number) => void
}

const defaultForm = {
  blockIdentifier: 'A',
  quantity: 15,
  front: 10,
  back: 10,
  leftSide: 15,
  rightSide: 15,
  totalArea: 150,
  price: 0,
  status: 'available',
}

const statusOptions = [
  { value: 'available', label: 'Disponivel' },
  { value: 'reserved', label: 'Reservado' },
  { value: 'on_hold', label: 'Bloqueado' },
  { value: 'sold', label: 'Vendido' },
] as const

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function makeIdentifier(index: number) {
  return String(index + 1).padStart(2, '0')
}

function createDrafts(form: typeof defaultForm): LotDraft[] {
  return Array.from({ length: Math.max(0, form.quantity) }, (_, index) => ({
    identifier: makeIdentifier(index),
    front: form.front,
    back: form.back,
    leftSide: form.leftSide,
    rightSide: form.rightSide,
    totalArea: form.totalArea,
    price: form.price,
    status: form.status,
  }))
}

export default function LotBatchDrawer({
  development,
  isOpen,
  onClose,
  onSave,
}: LotBatchDrawerProps) {
  const [form, setForm] = useState(defaultForm)
  const [drafts, setDrafts] = useState<LotDraft[]>(() => createDrafts(defaultForm))
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    if (!isOpen) return
    setForm(defaultForm)
    setDrafts(createDrafts(defaultForm))
    setErrors([])
  }, [isOpen, development?.id])

  const totalValue = useMemo(() => drafts.reduce((sum, draft) => sum + Number(draft.price || 0), 0), [drafts])
  const totalArea = useMemo(() => drafts.reduce((sum, draft) => sum + Number(draft.totalArea || 0), 0), [drafts])

  const updateForm = (field: keyof typeof defaultForm, value: string) => {
    const nextForm = {
      ...form,
      [field]: field === 'blockIdentifier' || field === 'status' ? value : Number(value),
    }
    setForm(nextForm)
    setDrafts(createDrafts(nextForm))
    setErrors([])
  }

  const updateDraft = (index: number, field: keyof LotDraft, value: string) => {
    setDrafts((current) =>
      current.map((draft, draftIndex) => (
        draftIndex === index
          ? { ...draft, [field]: field === 'identifier' || field === 'status' ? value : Number(value) }
          : draft
      )),
    )
    setErrors([])
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!development || saving) return

    try {
      setSaving(true)
      setErrors([])
      const response = await fetch(`/api/developments/${development.id}/lots/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockIdentifier: form.blockIdentifier,
          lots: drafts,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setErrors(payload.errors || [payload.error || 'Nao foi possivel criar os lotes.'])
        return
      }

      onSave(payload.lots?.length ?? drafts.length)
      onClose()
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Nao foi possivel criar os lotes.'])
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDrawer
      isOpen={isOpen}
      title='Configurar lotes'
      description={development ? `Gerencie o estoque inicial e complementar de ${development.name}.` : 'Gerencie os lotes do empreendimento.'}
      onClose={onClose}
      widthClassName='max-w-5xl'
    >
      <form onSubmit={handleSubmit} className='space-y-6'>
        {errors.length > 0 && (
          <div className='rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>
            <p className='font-semibold'>Revise os campos antes de salvar</p>
            <ul className='mt-2 list-disc space-y-1 pl-5'>
              {errors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          </div>
        )}

        <section className='rounded-2xl border border-border bg-surface-secondary p-5'>
          <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
            <div>
              <h3 className='text-base font-semibold text-foreground'>Resumo dos lotes</h3>
              <p className='mt-1 text-sm text-muted'>
                {development?.metrics?.totalLots
                  ? 'Use esta area para complementar novas quadras e lotes.'
                  : 'Nenhum lote cadastrado ainda. Crie a primeira quadra abaixo.'}
              </p>
            </div>
            {development?.id && (
              <a href={`/lots?developmentId=${development.id}`} className='rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-background'>
                Ver mapa/lista
              </a>
            )}
          </div>
          <div className='mt-5 grid grid-cols-2 gap-3 md:grid-cols-5'>
            {[
              ['Total', development?.metrics?.totalLots ?? 0],
              ['Disponiveis', development?.metrics?.availableLots ?? 0],
              ['Reservados', development?.metrics?.reservedLots ?? 0],
              ['Vendidos', development?.metrics?.soldLots ?? 0],
              ['VGV', formatCurrency(development?.metrics?.totalValue ?? 0)],
            ].map(([label, value]) => (
              <div key={label} className='rounded-xl border border-border bg-surface px-3 py-3'>
                <p className='text-xs font-semibold uppercase text-muted'>{label}</p>
                <p className='mt-1 text-base font-bold text-foreground'>{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className='rounded-2xl border border-border bg-surface-secondary p-5'>
          <div>
            <h3 className='text-base font-semibold text-foreground'>Nova quadra</h3>
            <p className='mt-1 text-sm text-muted'>Defina o modelo inicial. Depois ajuste os lotes diferentes na pre-visualizacao.</p>
          </div>

          <div className='mt-5 grid gap-4 md:grid-cols-2'>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Quadra</span>
              <input
                value={form.blockIdentifier}
                onChange={(event) => updateForm('blockIdentifier', event.target.value)}
                className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                placeholder='A'
              />
            </label>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Quantidade de lotes</span>
              <input
                type='number'
                min={1}
                max={300}
                value={form.quantity}
                onChange={(event) => updateForm('quantity', event.target.value)}
                className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
              />
            </label>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Frente (m)</span>
              <input type='number' min={0} step='0.01' value={form.front} onChange={(event) => updateForm('front', event.target.value)} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary' />
            </label>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Fundo (m)</span>
              <input type='number' min={0} step='0.01' value={form.back} onChange={(event) => updateForm('back', event.target.value)} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary' />
            </label>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Lateral esquerda (m)</span>
              <input type='number' min={0} step='0.01' value={form.leftSide} onChange={(event) => updateForm('leftSide', event.target.value)} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary' />
            </label>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Lateral direita (m)</span>
              <input type='number' min={0} step='0.01' value={form.rightSide} onChange={(event) => updateForm('rightSide', event.target.value)} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary' />
            </label>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Area padrao (m2)</span>
              <input type='number' min={0} step='0.01' value={form.totalArea} onChange={(event) => updateForm('totalArea', event.target.value)} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary' />
            </label>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Valor padrao</span>
              <input type='number' min={0} step='0.01' value={form.price} onChange={(event) => updateForm('price', event.target.value)} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary' />
            </label>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Status padrao</span>
              <select value={form.status} onChange={(event) => updateForm('status', event.target.value)} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className='rounded-2xl border border-border bg-surface-secondary p-5'>
          <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
            <div>
              <h3 className='text-base font-semibold text-foreground'>Pre-visualizacao editavel</h3>
              <p className='mt-1 text-sm text-muted'>Altere apenas os lotes fora do padrao antes de criar.</p>
            </div>
            <div className='grid grid-cols-2 gap-2 text-right text-sm'>
              <div className='rounded-xl border border-border bg-surface px-3 py-2'>
                <p className='text-xs font-semibold uppercase text-muted'>Area</p>
                <p className='font-bold text-foreground'>{totalArea.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m2</p>
              </div>
              <div className='rounded-xl border border-border bg-surface px-3 py-2'>
                <p className='text-xs font-semibold uppercase text-muted'>VGV</p>
                <p className='font-bold text-foreground'>{formatCurrency(totalValue)}</p>
              </div>
            </div>
          </div>

          <div className='mt-5 overflow-x-auto'>
            <table className='min-w-full divide-y divide-border text-sm'>
              <thead>
                <tr className='text-left text-xs font-semibold uppercase text-muted'>
                  <th className='px-2 py-2'>Lote</th>
                  <th className='px-2 py-2'>Area</th>
                  <th className='px-2 py-2'>Frente</th>
                  <th className='px-2 py-2'>Fundo</th>
                  <th className='px-2 py-2'>Valor</th>
                  <th className='px-2 py-2'>Status</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border'>
                {drafts.map((draft, index) => (
                  <tr key={index}>
                    <td className='px-2 py-2'>
                      <input value={draft.identifier} onChange={(event) => updateDraft(index, 'identifier', event.target.value)} className='w-20 rounded-lg border border-border bg-surface px-2 py-2 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary' />
                    </td>
                    <td className='px-2 py-2'>
                      <input type='number' min={0} step='0.01' value={draft.totalArea} onChange={(event) => updateDraft(index, 'totalArea', event.target.value)} className='w-24 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary' />
                    </td>
                    <td className='px-2 py-2'>
                      <input type='number' min={0} step='0.01' value={draft.front} onChange={(event) => updateDraft(index, 'front', event.target.value)} className='w-20 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary' />
                    </td>
                    <td className='px-2 py-2'>
                      <input type='number' min={0} step='0.01' value={draft.back} onChange={(event) => updateDraft(index, 'back', event.target.value)} className='w-20 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary' />
                    </td>
                    <td className='px-2 py-2'>
                      <input type='number' min={0} step='0.01' value={draft.price} onChange={(event) => updateDraft(index, 'price', event.target.value)} className='w-28 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary' />
                    </td>
                    <td className='px-2 py-2'>
                      <select value={draft.status} onChange={(event) => updateDraft(index, 'status', event.target.value)} className='w-32 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary'>
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className='flex justify-end gap-3 border-t border-border pt-6'>
          <button type='button' onClick={onClose} disabled={saving} className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary disabled:opacity-50'>Cancelar</button>
          <button type='submit' disabled={saving || drafts.length === 0} className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-50'>
            {saving ? 'Salvando lotes...' : `Criar ${drafts.length} lote(s)`}
          </button>
        </div>
      </form>
    </FormDrawer>
  )
}
