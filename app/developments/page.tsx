'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import DevelopmentForm from './components/DevelopmentForm'
import DevelopmentSettingsForm from './components/DevelopmentSettingsForm'
import InlineAlert from '@/app/components/InlineAlert'

interface Company {
  id: string
  name: string
}

interface Development {
  id: string
  name: string
  logo: string
  companyId: string
  createdAt: string
  company: Company
  settings?: {
    reservationValidityDays: number
    defaultInterestRate: number
    interestCalculation: string
    correctionIndex: string
    maxInstallments: number
    paymentMethods: string
  } | null
  _count?: {
    blocks: number
  }
}

interface Lot {
  id: string
  price: number
  status: string
  block: {
    development?: {
      id: string
    } | null
  }
}

type DevelopmentMetrics = {
  totalLots: number
  availableLots: number
  reservedLots: number
  soldLots: number
  totalValue: number
  soldPercentage: number
}

export default function DevelopmentsPage() {
  const [developments, setDevelopments] = useState<Development[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showSettingsForm, setShowSettingsForm] = useState(false)
  const [editingDevelopment, setEditingDevelopment] = useState<Development | null>(null)
  const [settingsDevelopment, setSettingsDevelopment] = useState<Development | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const fetchDevelopments = async () => {
    const response = await fetch('/api/developments')
    if (!response.ok) throw new Error('Nao foi possivel carregar os empreendimentos')
    const data = await response.json()
    setDevelopments(data)
  }

  const fetchCompanies = async () => {
    const response = await fetch('/api/companies')
    if (!response.ok) throw new Error('Nao foi possivel carregar as empresas')
    const data = await response.json()
    setCompanies(data)
  }

  const fetchLots = async () => {
    const response = await fetch('/api/lots', { cache: 'no-store' })
    if (!response.ok) throw new Error('Nao foi possivel carregar os lotes')
    const data = await response.json()
    setLots(data)
  }

  const refresh = async () => {
    try {
      setLoading(true)
      await Promise.all([fetchDevelopments(), fetchCompanies(), fetchLots()])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar empreendimentos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    if (!successMessage) return
    const timeout = setTimeout(() => setSuccessMessage(null), 4000)
    return () => clearTimeout(timeout)
  }, [successMessage])

  const filteredDevelopments = developments.filter((development) => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return development.name.toLowerCase().includes(searchLower) || development.company.name.toLowerCase().includes(searchLower)
  })

  const metricsByDevelopment = useMemo(() => {
    const map = new Map<string, DevelopmentMetrics>()

    developments.forEach((development) => {
      map.set(development.id, {
        totalLots: 0,
        availableLots: 0,
        reservedLots: 0,
        soldLots: 0,
        totalValue: 0,
        soldPercentage: 0,
      })
    })

    lots.forEach((lot) => {
      const developmentId = lot.block.development?.id
      if (!developmentId) return
      const metrics = map.get(developmentId)
      if (!metrics) return

      metrics.totalLots += 1
      metrics.totalValue += lot.price
      if (lot.status === 'sold') metrics.soldLots += 1
      if (lot.status === 'available') metrics.availableLots += 1
      if (lot.status === 'reserved' || lot.status === 'on_hold') metrics.reservedLots += 1
    })

    map.forEach((metrics) => {
      metrics.soldPercentage = metrics.totalLots > 0 ? (metrics.soldLots / metrics.totalLots) * 100 : 0
    })

    return map
  }, [developments, lots])

  const getInitials = (name: string) => name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2)
  const formatPercent = (value?: number) => `${Number(value ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value)
  const formatPaymentMethods = (methods?: string) => {
    const labels: Record<string, string> = {
      cash: 'A vista',
      installments: 'Parcelamento',
      financing: 'Financiamento',
      bank_slip: 'Boleto',
      pix: 'Pix',
    }

    const selected = methods?.split(',').filter(Boolean) ?? []
    if (selected.length === 0) return 'Nao configurado'
    return selected.map((method) => labels[method] ?? method).join(', ')
  }

  if (loading) return <div className='animate-pulse'><div className='h-8 w-64 rounded-xl bg-surface-secondary'></div></div>
  if (error) return <div className='rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700'>{error}</div>

  return (
    <div className='space-y-6'>
      {successMessage && (
        <InlineAlert
          variant='success'
          title='Operacao realizada com sucesso'
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}

      <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='page-title'>Empreendimentos</h1>
          <p className='page-subtitle'>Cadastre loteamentos e projetos ligados a uma empresa especifica.</p>
        </div>
        <div className='flex flex-wrap gap-3'>
          <button onClick={() => { setEditingDevelopment(null); setShowForm(true) }} disabled={companies.length === 0} className='rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-strong disabled:opacity-50'>Novo Empreendimento</button>
        </div>
      </div>

      <section className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]'>
        <div className='panel'>
          <div className='panel-header flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between'>
            <div>
              <h2 className='text-lg font-semibold text-foreground'>{searchTerm ? `${filteredDevelopments.length} de ${developments.length} empreendimentos` : `Total de empreendimentos: ${developments.length}`}</h2>
              <p className='mt-1 text-sm text-muted'>Acompanhe estoque, vendas e regras comerciais por loteamento.</p>
            </div>
            <input type='text' placeholder='Buscar por empreendimento ou empresa...' value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className='block w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary md:max-w-xs' />
          </div>

          {companies.length === 0 && <div className='mx-6 mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800'>Cadastre uma empresa antes de criar um empreendimento.</div>}

          <div className='grid gap-5 px-6 py-6 lg:grid-cols-2'>
            {filteredDevelopments.map((development) => {
              const metrics = metricsByDevelopment.get(development.id) ?? {
                totalLots: 0,
                availableLots: 0,
                reservedLots: 0,
                soldLots: 0,
                totalValue: 0,
                soldPercentage: 0,
              }

              return (
                <article key={development.id} className='rounded-2xl border border-border bg-surface p-5 shadow-sm'>
                  <div className='flex items-start justify-between gap-4'>
                    <div className='flex min-w-0 items-center gap-3'>
                      {development.logo ? (
                        <img src={development.logo} alt={`Logo de ${development.name}`} className='h-12 w-12 shrink-0 rounded-xl border border-border bg-background object-contain p-2' />
                      ) : (
                        <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white'>
                          {getInitials(development.name)}
                        </div>
                      )}
                      <div className='min-w-0'>
                        <h3 className='truncate text-base font-semibold text-foreground'>{development.name}</h3>
                        <p className='mt-1 truncate text-sm text-muted'>{development.company.name}</p>
                      </div>
                    </div>
                    <span className='shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary'>
                      {formatPercent(metrics.soldPercentage)} vendido
                    </span>
                  </div>

                  <div className='mt-5'>
                    <div className='h-2 overflow-hidden rounded-full bg-surface-secondary'>
                      <div className='h-full rounded-full bg-primary transition-all' style={{ width: `${Math.min(metrics.soldPercentage, 100)}%` }} />
                    </div>
                    <div className='mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4'>
                      {[
                        ['Lotes', metrics.totalLots],
                        ['Vendidos', metrics.soldLots],
                        ['Reservados', metrics.reservedLots],
                        ['Disponiveis', metrics.availableLots],
                      ].map(([label, value]) => (
                        <div key={label} className='rounded-xl border border-border bg-surface-secondary px-3 py-3'>
                          <p className='text-xs font-semibold uppercase text-muted'>{label}</p>
                          <p className='mt-1 text-lg font-bold text-foreground'>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className='mt-5 grid gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-4 text-sm text-muted sm:grid-cols-2'>
                    <p><span className='font-semibold text-foreground'>VGV:</span> {formatCurrency(metrics.totalValue)}</p>
                    <p><span className='font-semibold text-foreground'>Quadras:</span> {development._count?.blocks ?? 0}</p>
                    <p><span className='font-semibold text-foreground'>Reserva:</span> {development.settings?.reservationValidityDays ?? 7} dias</p>
                    <p><span className='font-semibold text-foreground'>Juros:</span> {formatPercent(development.settings?.defaultInterestRate)} a.m.</p>
                    <p className='sm:col-span-2'><span className='font-semibold text-foreground'>Pagamento:</span> {formatPaymentMethods(development.settings?.paymentMethods)}</p>
                  </div>

                  <div className='mt-5 flex flex-wrap justify-end gap-2'>
                    <Link href={`/lots?developmentId=${development.id}`} className='rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-strong'>
                      Ver lotes
                    </Link>
                    <Link href={`/onboarding?developmentId=${development.id}`} className='rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'>
                      {metrics.totalLots > 0 ? 'Complementar lotes' : 'Criar lotes'}
                    </Link>
                    <button onClick={() => { setSettingsDevelopment(development); setShowSettingsForm(true) }} className='rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'>Configurar</button>
                    <button onClick={() => { setEditingDevelopment(development); setShowForm(true) }} className='rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'>Editar</button>
                  </div>
                </article>
              )
            })}

            {filteredDevelopments.length === 0 && (
              <div className='rounded-2xl border border-dashed border-border bg-surface-secondary px-6 py-12 text-center'>
                <p className='text-sm font-semibold text-foreground'>Nenhum empreendimento encontrado</p>
                <p className='mt-2 text-sm text-muted'>Ajuste a busca ou crie um novo empreendimento.</p>
              </div>
            )}
          </div>
        </div>

        <aside className='panel'>
          <div className='panel-header px-6 py-5'>
            <h2 className='text-lg font-semibold text-foreground'>Regras comerciais</h2>
            <p className='mt-1 text-sm text-muted'>Defina padroes que serao usados em reserva, simulacao e venda.</p>
          </div>
          <div className='space-y-4 px-6 py-6'>
            <div className='rounded-2xl border border-border bg-surface-secondary px-4 py-4'>
              <p className='text-sm font-semibold text-foreground'>Padroes por empreendimento</p>
              <p className='mt-2 text-sm leading-6 text-muted'>Cada loteamento pode ter prazo de reserva, juros, correcao, entrada minima e formas de pagamento proprios.</p>
            </div>
            <div className='rounded-2xl border border-border bg-surface-secondary px-4 py-4'>
              <p className='text-sm font-semibold text-foreground'>Proximo uso</p>
              <p className='mt-2 text-sm leading-6 text-muted'>O simulador financeiro deve carregar esses valores como padrao antes de montar propostas.</p>
            </div>
          </div>
        </aside>
      </section>
      <DevelopmentForm
        development={editingDevelopment}
        companies={companies}
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingDevelopment(null) }}
        onSave={async (mode) => {
          await refresh()
          setShowForm(false)
          setEditingDevelopment(null)
          setSuccessMessage(
            mode === 'create'
              ? 'O empreendimento foi criado com sucesso.'
              : 'O empreendimento foi atualizado com sucesso.',
          )
        }}
      />
      <DevelopmentSettingsForm
        development={settingsDevelopment}
        isOpen={showSettingsForm}
        onClose={() => { setShowSettingsForm(false); setSettingsDevelopment(null) }}
        onSave={async () => {
          await refresh()
          setShowSettingsForm(false)
          setSettingsDevelopment(null)
          setSuccessMessage('As configuracoes comerciais foram atualizadas com sucesso.')
        }}
      />
    </div>
  )
}
