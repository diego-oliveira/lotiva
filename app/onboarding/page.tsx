'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type ChecklistStatus = 'complete' | 'action' | 'pending'

type ChecklistItem = {
  id: string
  title: string
  description: string
  href: string
  status: ChecklistStatus
  metric: string
}

type OnboardingStatus = {
  progress: number
  readyForSales: boolean
  completedCount: number
  totalCount: number
  counts: {
    companies: number
    developments: number
    users: number
    blocks: number
    lots: number
    pricedLots: number
    availableLots: number
  }
  setup: {
    company: {
      id: string
      name: string
      logo: string
    } | null
    development: {
      id: string
      name: string
      logo: string
      companyId: string
    } | null
    inventory: {
      blockCount: number | null
      lotsPerBlock: number | null
      lotArea: number | null
      lotFront: number | null
      lotBack: number | null
      lotLeftSide: number | null
      lotRightSide: number | null
      lotPrice: number | null
      initialStatus: SetupForm['initialStatus'] | null
    }
  }
  checklist: ChecklistItem[]
}

type SetupForm = {
  companyId: string | null
  companyName: string
  companyLogo: string
  developmentId: string | null
  developmentName: string
  developmentLogo: string
  blockCount: number
  lotsPerBlock: number
  lotArea: number
  lotFront: number
  lotBack: number
  lotLeftSide: number
  lotRightSide: number
  lotPrice: number
  initialStatus: 'available' | 'reserved' | 'on_hold' | 'sold'
  blockPrefix: 'number' | 'letter'
}

type CreatedSetup = {
  development: {
    id: string
    name: string
  }
  createdBlocks: number
  createdLots: number
  updatedExistingSetup: boolean
  skippedInventoryCreation: boolean
}

const defaultLogo = 'https://placehold.co/320x160/png?text=Lotiva'

const initialForm: SetupForm = {
  companyId: null,
  companyName: '',
  companyLogo: defaultLogo,
  developmentId: null,
  developmentName: '',
  developmentLogo: defaultLogo,
  blockCount: 4,
  lotsPerBlock: 12,
  lotArea: 250,
  lotFront: 10,
  lotBack: 10,
  lotLeftSide: 25,
  lotRightSide: 25,
  lotPrice: 85000,
  initialStatus: 'available',
  blockPrefix: 'letter',
}

const statusLabel: Record<ChecklistStatus, string> = {
  complete: 'Concluido',
  action: 'Acao necessaria',
  pending: 'Aguardando',
}

const statusClass: Record<ChecklistStatus, string> = {
  complete: 'bg-emerald-50 text-emerald-700',
  action: 'bg-amber-50 text-amber-700',
  pending: 'bg-slate-100 text-slate-600',
}

const statusOptions = [
  { value: 'available', label: 'Disponivel' },
  { value: 'reserved', label: 'Reservado' },
  { value: 'on_hold', label: 'Bloqueado' },
  { value: 'sold', label: 'Vendido' },
] as const

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

function NumberField({
  label,
  name,
  value,
  min = 1,
  max,
  onChange,
  suffix,
}: {
  label: string
  name: keyof SetupForm
  value: number
  min?: number
  max?: number
  onChange: (name: keyof SetupForm, value: number) => void
  suffix?: string
}) {
  return (
    <label className='block'>
      <span className='mb-2 block text-sm font-semibold text-foreground'>{label}</span>
      <div className='relative'>
        <input
          type='number'
          min={min}
          max={max}
          step='0.01'
          name={name}
          value={value}
          onChange={(event) => onChange(name, Number(event.target.value))}
          className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary'
        />
        {suffix && <span className='pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted'>{suffix}</span>}
      </div>
    </label>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [formData, setFormData] = useState<SetupForm>(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [createdSetup, setCreatedSetup] = useState<CreatedSetup | null>(null)

  async function fetchStatus() {
    const response = await fetch('/api/onboarding/status', { cache: 'no-store' })
    if (!response.ok) throw new Error('Nao foi possivel carregar o status do onboarding')
    const payload = (await response.json()) as OnboardingStatus
    setStatus(payload)
    setFormData((current) => ({
      ...current,
      companyId: payload.setup.company?.id ?? current.companyId,
      companyName: payload.setup.company?.name ?? current.companyName,
      companyLogo: payload.setup.company?.logo ?? current.companyLogo,
      developmentId: payload.setup.development?.id ?? current.developmentId,
      developmentName: payload.setup.development?.name ?? current.developmentName,
      developmentLogo: payload.setup.development?.logo ?? current.developmentLogo,
      blockCount: payload.setup.inventory.blockCount || current.blockCount,
      lotsPerBlock: payload.setup.inventory.lotsPerBlock || current.lotsPerBlock,
      lotArea: payload.setup.inventory.lotArea || current.lotArea,
      lotFront: payload.setup.inventory.lotFront || current.lotFront,
      lotBack: payload.setup.inventory.lotBack || current.lotBack,
      lotLeftSide: payload.setup.inventory.lotLeftSide || current.lotLeftSide,
      lotRightSide: payload.setup.inventory.lotRightSide || current.lotRightSide,
      lotPrice: payload.setup.inventory.lotPrice || current.lotPrice,
      initialStatus: payload.setup.inventory.initialStatus ?? current.initialStatus,
    }))
  }

  useEffect(() => {
    async function loadStatus() {
      try {
        setLoading(true)
        await fetchStatus()
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar onboarding')
      } finally {
        setLoading(false)
      }
    }

    void loadStatus()
  }, [])

  const totals = useMemo(() => {
    const lots = formData.blockCount * formData.lotsPerBlock
    return {
      lots,
      totalArea: lots * formData.lotArea,
      totalValue: lots * formData.lotPrice,
    }
  }, [formData])

  const nextStep = useMemo(
    () => status?.checklist.find((item) => item.status === 'action') ?? status?.checklist.find((item) => item.status === 'pending'),
    [status],
  )

  const updateTextField = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: '' }))
  }

  const updateNumberField = (name: keyof SetupForm, value: number) => {
    setFormData((current) => ({ ...current, [name]: Number.isFinite(value) ? value : 0 }))
    setFieldErrors((current) => ({ ...current, [name]: '' }))
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}

    if (!formData.companyName.trim()) errors.companyName = 'Informe o nome da empresa.'
    if (!formData.developmentName.trim()) errors.developmentName = 'Informe o nome do empreendimento.'

    for (const [field, value] of [
      ['blockCount', formData.blockCount],
      ['lotsPerBlock', formData.lotsPerBlock],
      ['lotArea', formData.lotArea],
      ['lotFront', formData.lotFront],
      ['lotBack', formData.lotBack],
      ['lotLeftSide', formData.lotLeftSide],
      ['lotRightSide', formData.lotRightSide],
      ['lotPrice', formData.lotPrice],
    ] as const) {
      if (!Number.isFinite(value) || value <= 0) errors[field] = 'Informe um valor maior que zero.'
    }

    if (formData.blockCount * formData.lotsPerBlock > 1000) {
      errors.lotsPerBlock = 'O onboarding inicial permite criar ate 1000 lotes.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!validateForm()) return

    try {
      setSaving(true)
      setError(null)
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const payload = await response.json()
        if (payload.errors) setFieldErrors(payload.errors)
        throw new Error(payload.error ?? 'Nao foi possivel criar o onboarding')
      }

      const payload = (await response.json()) as CreatedSetup
      setCreatedSetup(payload)
      await fetchStatus()
      router.push('/developments')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar onboarding')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className='space-y-6'>
        <div className='h-28 animate-pulse rounded-2xl bg-surface-secondary' />
        <div className='grid gap-4 md:grid-cols-3'>
          {[1, 2, 3].map((item) => (
            <div key={item} className='h-36 animate-pulse rounded-2xl bg-surface-secondary' />
          ))}
        </div>
      </div>
    )
  }

  if (error && !status) {
    return <div className='rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700'>{error}</div>
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='page-title'>Onboarding do empreendimento</h1>
          <p className='page-subtitle'>Configure a empresa, o loteamento e o estoque inicial de lotes para iniciar a operacao comercial.</p>
        </div>
        <div className='flex flex-wrap gap-3'>
          <Link href='/developments' className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'>
            Ver empreendimentos
          </Link>
          {nextStep && (
            <Link href={nextStep.href} className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-strong'>
              Continuar configuracao
            </Link>
          )}
        </div>
      </div>

      {createdSetup && (
        <div className='rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800'>
          {createdSetup.updatedExistingSetup
            ? `${createdSetup.development.name} atualizado com sucesso.`
            : `${createdSetup.development.name} criado com ${createdSetup.createdBlocks} quadras e ${createdSetup.createdLots} lotes.`}
          {createdSetup.skippedInventoryCreation && ' O inventario existente foi mantido.'}
        </div>
      )}

      {error && (
        <div className='rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>
          {error}
        </div>
      )}

      <section className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]'>
        <form onSubmit={handleSubmit} className='panel overflow-hidden'>
          <div className='panel-header px-6 py-5'>
            <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
              <div>
                <p className='text-sm font-medium text-muted'>Cadastro guiado</p>
                <h2 className='mt-2 text-xl font-bold text-foreground'>{formData.developmentId ? 'Atualizar base inicial para venda' : 'Criar base inicial para venda'}</h2>
              </div>
              <span className='pill bg-primary/10 text-primary'>{totals.lots} lotes previstos</span>
            </div>
          </div>

          <div className='space-y-8 px-6 py-6'>
            <section className='space-y-4'>
              <div>
                <h3 className='text-base font-semibold text-foreground'>1. Empresa proprietaria</h3>
                <p className='mt-1 text-sm text-muted'>Use a empresa juridica responsavel pelo loteamento.</p>
              </div>
              <div className='grid gap-4 md:grid-cols-2'>
                <label className='block'>
                  <span className='mb-2 block text-sm font-semibold text-foreground'>Nome da empresa</span>
                  <input
                    name='companyName'
                    value={formData.companyName}
                    onChange={updateTextField}
                    placeholder='Oliveira Construcoes'
                    className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary'
                  />
                  {fieldErrors.companyName && <p className='mt-2 text-sm text-red-600'>{fieldErrors.companyName}</p>}
                </label>
                <label className='block'>
                  <span className='mb-2 block text-sm font-semibold text-foreground'>URL do logo</span>
                  <input
                    name='companyLogo'
                    value={formData.companyLogo}
                    onChange={updateTextField}
                    placeholder='https://example.com/logo.png'
                    className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary'
                  />
                  {fieldErrors.companyLogo && <p className='mt-2 text-sm text-red-600'>{fieldErrors.companyLogo}</p>}
                </label>
              </div>
            </section>

            <section className='space-y-4'>
              <div>
                <h3 className='text-base font-semibold text-foreground'>2. Empreendimento</h3>
                <p className='mt-1 text-sm text-muted'>Este sera o loteamento onde quadras e lotes ficarao vinculados.</p>
              </div>
              <div className='grid gap-4 md:grid-cols-2'>
                <label className='block'>
                  <span className='mb-2 block text-sm font-semibold text-foreground'>Nome do empreendimento</span>
                  <input
                    name='developmentName'
                    value={formData.developmentName}
                    onChange={updateTextField}
                    placeholder='Loteamento Cajueiro I'
                    className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary'
                  />
                  {fieldErrors.developmentName && <p className='mt-2 text-sm text-red-600'>{fieldErrors.developmentName}</p>}
                </label>
                <label className='block'>
                  <span className='mb-2 block text-sm font-semibold text-foreground'>URL do logo</span>
                  <input
                    name='developmentLogo'
                    value={formData.developmentLogo}
                    onChange={updateTextField}
                    placeholder='https://example.com/logo.png'
                    className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary'
                  />
                  {fieldErrors.developmentLogo && <p className='mt-2 text-sm text-red-600'>{fieldErrors.developmentLogo}</p>}
                </label>
              </div>
            </section>

            <section className='space-y-4'>
              <div>
                <h3 className='text-base font-semibold text-foreground'>3. Quadras e lotes iniciais</h3>
                <p className='mt-1 text-sm text-muted'>Crie um estoque padrao agora. Depois cada lote podera ser ajustado individualmente.</p>
              </div>
              <div className='grid gap-4 md:grid-cols-3'>
                <NumberField label='Quadras' name='blockCount' value={formData.blockCount} max={80} onChange={updateNumberField} />
                <NumberField label='Lotes por quadra' name='lotsPerBlock' value={formData.lotsPerBlock} max={200} onChange={updateNumberField} />
                <label className='block'>
                  <span className='mb-2 block text-sm font-semibold text-foreground'>Identificacao da quadra</span>
                  <select
                    value={formData.blockPrefix}
                    onChange={(event) => setFormData((current) => ({ ...current, blockPrefix: event.target.value as SetupForm['blockPrefix'] }))}
                    className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary'
                  >
                    <option value='letter'>A, B, C...</option>
                    <option value='number'>1, 2, 3...</option>
                  </select>
                </label>
              </div>
              {(fieldErrors.blockCount || fieldErrors.lotsPerBlock) && (
                <p className='text-sm text-red-600'>{fieldErrors.blockCount ?? fieldErrors.lotsPerBlock}</p>
              )}
            </section>

            <section className='space-y-4'>
              <div>
                <h3 className='text-base font-semibold text-foreground'>4. Medidas, preco e status inicial</h3>
                <p className='mt-1 text-sm text-muted'>Esses valores serao aplicados aos lotes criados pelo onboarding.</p>
              </div>
              <div className='grid gap-4 md:grid-cols-3'>
                <NumberField label='Area padrao' name='lotArea' value={formData.lotArea} onChange={updateNumberField} suffix='m2' />
                <NumberField label='Valor padrao' name='lotPrice' value={formData.lotPrice} onChange={updateNumberField} />
                <label className='block'>
                  <span className='mb-2 block text-sm font-semibold text-foreground'>Status inicial</span>
                  <select
                    value={formData.initialStatus}
                    onChange={(event) => setFormData((current) => ({ ...current, initialStatus: event.target.value as SetupForm['initialStatus'] }))}
                    className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary'
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <NumberField label='Frente' name='lotFront' value={formData.lotFront} onChange={updateNumberField} suffix='m' />
                <NumberField label='Fundo' name='lotBack' value={formData.lotBack} onChange={updateNumberField} suffix='m' />
                <NumberField label='Lateral esquerda' name='lotLeftSide' value={formData.lotLeftSide} onChange={updateNumberField} suffix='m' />
                <NumberField label='Lateral direita' name='lotRightSide' value={formData.lotRightSide} onChange={updateNumberField} suffix='m' />
              </div>
            </section>
          </div>

          <div className='flex flex-col gap-3 border-t border-border px-6 py-5 md:flex-row md:items-center md:justify-between'>
            <p className='text-sm text-muted'>
              Total estimado: <span className='font-semibold text-foreground'>{formatCurrency(totals.totalValue)}</span>
            </p>
            <button
              type='submit'
              disabled={saving}
              className='rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-60'
            >
              {saving ? 'Salvando onboarding...' : formData.developmentId ? 'Salvar configuracao inicial' : 'Criar empreendimento inicial'}
            </button>
          </div>
        </form>

        <aside className='space-y-6'>
          <div className='panel'>
            <div className='panel-header px-6 py-5'>
              <h2 className='text-lg font-semibold text-foreground'>Progresso</h2>
              <p className='mt-1 text-sm text-muted'>
                {status?.readyForSales ? 'Base pronta para iniciar vendas.' : `${status?.completedCount ?? 0} de ${status?.totalCount ?? 0} etapas concluidas.`}
              </p>
            </div>
            <div className='px-6 py-6'>
              <div className='h-3 overflow-hidden rounded-full bg-surface-secondary'>
                <div className='h-full rounded-full bg-primary transition-all' style={{ width: `${status?.progress ?? 0}%` }} />
              </div>
              <div className='mt-5 space-y-3'>
                {status?.checklist.map((item, index) => (
                  <div key={item.id} className='flex gap-3 rounded-xl border border-border bg-surface-secondary p-3'>
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${item.status === 'complete' ? 'bg-emerald-600 text-white' : item.status === 'action' ? 'bg-primary text-white' : 'bg-slate-200 text-muted'}`}>
                      {item.status === 'complete' ? 'OK' : index + 1}
                    </div>
                    <div className='min-w-0'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <p className='text-sm font-semibold text-foreground'>{item.title}</p>
                        <span className={`pill ${statusClass[item.status]}`}>{statusLabel[item.status]}</span>
                      </div>
                      <p className='mt-1 text-xs leading-5 text-muted'>{item.metric}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className='panel'>
            <div className='panel-header px-6 py-5'>
              <h2 className='text-lg font-semibold text-foreground'>Resumo do setup</h2>
            </div>
            <div className='grid grid-cols-2 gap-4 px-6 py-6'>
              {[
                ['Quadras', formData.blockCount],
                ['Lotes', totals.lots],
                ['Area total', `${totals.totalArea.toLocaleString('pt-BR')} m2`],
                ['VGV inicial', formatCurrency(totals.totalValue)],
              ].map(([label, value]) => (
                <div key={label} className='rounded-xl border border-border bg-surface-secondary px-4 py-4'>
                  <p className='text-xs font-semibold uppercase text-muted'>{label}</p>
                  <p className='mt-2 text-lg font-bold text-foreground'>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  )
}
