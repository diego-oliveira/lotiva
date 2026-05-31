'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type ViewMode = 'map' | 'list'
type SortField = 'identifier' | 'block' | 'totalArea' | 'price' | 'status'

interface Development {
  id: string
  name: string
}

interface Block {
  id: string
  identifier: string
  development?: Development | null
}

interface Person {
  id: string
  name: string
  email: string
}

interface LotReservation {
  id: string
  proposal: string
  status: string
  expiresAt?: string | null
  cancelledAt?: string | null
  createdAt: string
  updatedAt: string
  user: Person
  sale?: { id: string } | null
}

interface LotSale {
  id: string
  installmentCount: number
  installmentValue: number
  downPayment: number
  annualAdjustment: boolean
  totalValue: number
  createdAt: string
  updatedAt: string
  user: Person
  contract?: { id: string; contractNumber: string; emailSent: boolean } | null
}

interface Lot {
  id: string
  identifier: string
  blockId: string
  front: number
  back: number
  leftSide: number
  rightSide: number
  totalArea: number
  price: number
  status: string
  createdAt: string
  updatedAt: string
  block: Block
  reservations: LotReservation[]
  sale?: LotSale | null
}

const statusMeta: Record<string, { label: string; tile: string; badge: string; dot: string }> = {
  available: {
    label: 'Disponivel',
    tile: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
    badge: 'bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  reserved: {
    label: 'Reservado',
    tile: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
    badge: 'bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
  },
  on_hold: {
    label: 'Bloqueado',
    tile: 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200',
    badge: 'bg-slate-100 text-slate-700',
    dot: 'bg-slate-500',
  },
  sold: {
    label: 'Vendido',
    tile: 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100',
    badge: 'bg-red-50 text-red-700',
    dot: 'bg-red-500',
  },
}

function getStatusMeta(status: string) {
  return statusMeta[status] ?? {
    label: status || 'Sem status',
    tile: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
    badge: 'bg-slate-100 text-slate-700',
    dot: 'bg-slate-400',
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatArea(value: number) {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m2`
}

function formatMeasurement(value: number) {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m`
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR')
}

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10)
}

function getDefaultExpirationDate(days = 7) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return formatDateInput(date)
}

function compareNatural(a: string, b: string) {
  return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })
}

function getActiveReservation(lot: Lot) {
  return lot.reservations.find((reservation) => !reservation.sale && reservation.status !== 'cancelled' && !reservation.cancelledAt) ?? lot.reservations[0] ?? null
}

function getLotContact(lot: Lot) {
  if (lot.sale) return { label: 'Comprador', person: lot.sale.user }
  const reservation = getActiveReservation(lot)
  if (reservation) return { label: 'Cliente da reserva', person: reservation.user }
  return null
}

function isReservationExpired(reservation: LotReservation | null) {
  return Boolean(reservation?.expiresAt && new Date(reservation.expiresAt) < new Date())
}

export default function LotsPage() {
  const [lots, setLots] = useState<Lot[]>([])
  const [clients, setClients] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reservationError, setReservationError] = useState<string | null>(null)
  const [reservationSaving, setReservationSaving] = useState(false)
  const [showReservationForm, setShowReservationForm] = useState(false)
  const [reservationForm, setReservationForm] = useState({
    userId: '',
    proposal: '',
    expiresAt: getDefaultExpirationDate(),
  })
  const [viewMode, setViewMode] = useState<ViewMode>('map')
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null)
  const [developmentFilter, setDevelopmentFilter] = useState('')
  const [blockFilter, setBlockFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<SortField>('block')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  async function fetchLots() {
    try {
      setLoading(true)
      const response = await fetch('/api/lots', { cache: 'no-store' })
      if (!response.ok) throw new Error('Nao foi possivel carregar os lotes')
      setLots(await response.json())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar lotes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchLots()
  }, [])

  async function fetchClients() {
    const response = await fetch('/api/clients', { cache: 'no-store' })
    if (!response.ok) throw new Error('Nao foi possivel carregar clientes')
    setClients(await response.json())
  }

  const developments = useMemo(() => {
    const map = new Map<string, Development>()
    lots.forEach((lot) => {
      if (lot.block.development) map.set(lot.block.development.id, lot.block.development)
    })
    return Array.from(map.values()).sort((a, b) => compareNatural(a.name, b.name))
  }, [lots])

  const blocks = useMemo(() => {
    const map = new Map<string, Block>()
    lots.forEach((lot) => {
      if (!developmentFilter || lot.block.development?.id === developmentFilter) {
        map.set(lot.block.id, lot.block)
      }
    })
    return Array.from(map.values()).sort((a, b) => compareNatural(a.identifier, b.identifier))
  }, [lots, developmentFilter])

  const statuses = useMemo(() => {
    const values = [...new Set(lots.map((lot) => lot.status).filter(Boolean))]
    return values.sort((a, b) => compareNatural(getStatusMeta(a).label, getStatusMeta(b).label))
  }, [lots])

  const filteredLots = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const digits = searchTerm.replace(/\D/g, '')

    return lots
      .filter((lot) => !developmentFilter || lot.block.development?.id === developmentFilter)
      .filter((lot) => !blockFilter || lot.blockId === blockFilter)
      .filter((lot) => !statusFilter || lot.status === statusFilter)
      .filter((lot) => {
        if (!query) return true
        return (
          lot.identifier.toLowerCase().includes(query) ||
          lot.block.identifier.toLowerCase().includes(query) ||
          lot.block.development?.name.toLowerCase().includes(query) ||
          Boolean(digits && lot.identifier.replace(/\D/g, '').includes(digits))
        )
      })
      .sort((a, b) => {
        let result = 0

        if (sortBy === 'identifier') result = compareNatural(a.identifier, b.identifier)
        if (sortBy === 'block') {
          result = compareNatural(a.block.identifier, b.block.identifier)
          if (result === 0) result = compareNatural(a.identifier, b.identifier)
        }
        if (sortBy === 'totalArea') result = a.totalArea - b.totalArea
        if (sortBy === 'price') result = a.price - b.price
        if (sortBy === 'status') result = compareNatural(getStatusMeta(a.status).label, getStatusMeta(b.status).label)

        return sortDirection === 'asc' ? result : -result
      })
  }, [lots, developmentFilter, blockFilter, statusFilter, searchTerm, sortBy, sortDirection])

  const lotsByBlock = useMemo(() => {
    const map = new Map<string, { block: Block; lots: Lot[] }>()

    filteredLots.forEach((lot) => {
      const current = map.get(lot.blockId)
      if (current) {
        current.lots.push(lot)
      } else {
        map.set(lot.blockId, { block: lot.block, lots: [lot] })
      }
    })

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        lots: group.lots.sort((a, b) => compareNatural(a.identifier, b.identifier)),
      }))
      .sort((a, b) => compareNatural(a.block.identifier, b.block.identifier))
  }, [filteredLots])

  const selectedLot = useMemo(
    () => filteredLots.find((lot) => lot.id === selectedLotId) ?? lots.find((lot) => lot.id === selectedLotId) ?? null,
    [filteredLots, lots, selectedLotId],
  )

  const stats = useMemo(() => {
    const totalValue = filteredLots.reduce((sum, lot) => sum + lot.price, 0)

    return {
      total: filteredLots.length,
      available: filteredLots.filter((lot) => lot.status === 'available').length,
      reserved: filteredLots.filter((lot) => lot.status === 'reserved' || lot.status === 'on_hold').length,
      sold: filteredLots.filter((lot) => lot.status === 'sold').length,
      totalValue,
    }
  }, [filteredLots])

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDirection('asc')
    }
  }

  const clearFilters = () => {
    setDevelopmentFilter('')
    setBlockFilter('')
    setStatusFilter('')
    setSearchTerm('')
    setSelectedLotId(null)
  }

  const handleDevelopmentChange = (developmentId: string) => {
    setDevelopmentFilter(developmentId)
    setBlockFilter('')
    setSelectedLotId(null)
  }

  const selectLot = (lotId: string) => {
    setSelectedLotId((current) => (current === lotId ? null : lotId))
    setShowReservationForm(false)
    setReservationError(null)
  }

  const openReservationForm = async () => {
    if (!selectedLot) return

    try {
      setReservationError(null)
      if (clients.length === 0) await fetchClients()
      const activeReservation = getActiveReservation(selectedLot)
      setReservationForm({
        userId: activeReservation?.user.id ?? '',
        proposal: activeReservation?.proposal ?? '',
        expiresAt: activeReservation?.expiresAt ? formatDateInput(new Date(activeReservation.expiresAt)) : getDefaultExpirationDate(),
      })
      setShowReservationForm(true)
    } catch (err) {
      setReservationError(err instanceof Error ? err.message : 'Erro ao carregar clientes')
    }
  }

  const saveReservation = async () => {
    if (!selectedLot) return
    if (!reservationForm.userId) {
      setReservationError('Selecione um cliente para reservar o lote.')
      return
    }

    try {
      setReservationSaving(true)
      setReservationError(null)
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotId: selectedLot.id,
          userId: reservationForm.userId,
          proposal: reservationForm.proposal,
          expiresAt: reservationForm.expiresAt,
          status: 'active',
        }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Erro ao reservar lote')
      }

      await fetchLots()
      setShowReservationForm(false)
    } catch (err) {
      setReservationError(err instanceof Error ? err.message : 'Erro ao reservar lote')
    } finally {
      setReservationSaving(false)
    }
  }

  const cancelReservation = async () => {
    if (!selectedLot) return
    const activeReservation = getActiveReservation(selectedLot)
    if (!activeReservation) return

    try {
      setReservationSaving(true)
      setReservationError(null)
      const response = await fetch(`/api/reservations/${activeReservation.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Erro ao cancelar reserva')
      }

      await fetchLots()
      setShowReservationForm(false)
    } catch (err) {
      setReservationError(err instanceof Error ? err.message : 'Erro ao cancelar reserva')
    } finally {
      setReservationSaving(false)
    }
  }

  if (loading) {
    return (
      <div className='space-y-6'>
        <div className='h-24 animate-pulse rounded-2xl bg-surface-secondary' />
        <div className='grid gap-4 md:grid-cols-4'>
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className='h-24 animate-pulse rounded-2xl bg-surface-secondary' />
          ))}
        </div>
        <div className='h-96 animate-pulse rounded-2xl bg-surface-secondary' />
      </div>
    )
  }

  if (error) {
    return (
      <div className='rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700'>
        <p className='font-semibold'>Erro ao carregar lotes</p>
        <p className='mt-1 text-sm'>{error}</p>
        <button onClick={fetchLots} className='mt-4 rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-800 transition hover:bg-red-200'>
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='page-title'>Lotes</h1>
          <p className='page-subtitle'>Consulte disponibilidade no mapa operacional ou compare os lotes pela lista.</p>
        </div>
        <div className='flex flex-wrap gap-3'>
          <button onClick={fetchLots} className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'>
            Atualizar
          </button>
          <div className='inline-flex overflow-hidden rounded-xl border border-border bg-surface p-1'>
            <button
              onClick={() => setViewMode('map')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${viewMode === 'map' ? 'bg-primary text-white' : 'text-muted hover:bg-surface-secondary hover:text-foreground'}`}
            >
              Mapa
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${viewMode === 'list' ? 'bg-primary text-white' : 'text-muted hover:bg-surface-secondary hover:text-foreground'}`}
            >
              Lista
            </button>
          </div>
        </div>
      </div>

      <section className='grid gap-4 md:grid-cols-4'>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Lotes filtrados</p>
          <p className='metric-value'>{stats.total}</p>
        </div>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Disponiveis</p>
          <p className='metric-value text-emerald-700'>{stats.available}</p>
        </div>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Reservados/bloqueados</p>
          <p className='metric-value text-amber-700'>{stats.reserved}</p>
        </div>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Valor em estoque</p>
          <p className='metric-value'>{formatCurrency(stats.totalValue)}</p>
        </div>
      </section>

      <section className='panel overflow-hidden'>
        <div className='panel-header px-6 py-5'>
          <div className='grid gap-4 lg:grid-cols-[minmax(220px,1.3fr)_minmax(160px,0.8fr)_minmax(160px,0.8fr)_minmax(160px,0.8fr)_auto] lg:items-end'>
            <label className='block'>
              <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Busca</span>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder='Lote, quadra ou empreendimento...'
                className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
              />
            </label>
            <label className='block'>
              <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Empreendimento</span>
              <select
                value={developmentFilter}
                onChange={(event) => handleDevelopmentChange(event.target.value)}
                className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
              >
                <option value=''>Todos</option>
                {developments.map((development) => (
                  <option key={development.id} value={development.id}>{development.name}</option>
                ))}
              </select>
            </label>
            <label className='block'>
              <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Quadra</span>
              <select
                value={blockFilter}
                onChange={(event) => { setBlockFilter(event.target.value); setSelectedLotId(null) }}
                className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
              >
                <option value=''>Todas</option>
                {blocks.map((block) => (
                  <option key={block.id} value={block.id}>Quadra {block.identifier}</option>
                ))}
              </select>
            </label>
            <label className='block'>
              <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => { setStatusFilter(event.target.value); setSelectedLotId(null) }}
                className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
              >
                <option value=''>Todos</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>{getStatusMeta(status).label}</option>
                ))}
              </select>
            </label>
            <button onClick={clearFilters} className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'>
              Limpar
            </button>
          </div>
        </div>

        <div className='grid min-h-[620px] xl:grid-cols-[minmax(0,1fr)_360px]'>
          <div className='min-w-0 border-b border-border xl:border-b-0 xl:border-r'>
            {filteredLots.length === 0 ? (
              <div className='flex min-h-[420px] flex-col items-center justify-center px-6 py-12 text-center'>
                <div className='flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-secondary text-muted'>
                  <svg className='h-7 w-7' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M4 6h16v12H4zM8 6v12M16 6v12M4 10h16M4 14h16' />
                  </svg>
                </div>
                <h2 className='mt-4 text-base font-semibold text-foreground'>Nenhum lote encontrado</h2>
                <p className='mt-2 text-sm text-muted'>Ajuste os filtros para visualizar o mapa ou a lista de lotes.</p>
              </div>
            ) : viewMode === 'map' ? (
              <div className='space-y-6 p-6'>
                <div className='flex flex-wrap gap-3'>
                  {Object.entries(statusMeta).map(([status, meta]) => (
                    <div key={status} className='flex items-center gap-2 text-xs font-semibold text-muted'>
                      <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </div>
                  ))}
                </div>

                <div className='space-y-6'>
                  {lotsByBlock.map(({ block, lots: blockLots }) => (
                    <section key={block.id} className='rounded-2xl border border-border bg-surface-secondary p-4'>
                      <div className='mb-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between'>
                        <div>
                          <h2 className='text-base font-semibold text-foreground'>Quadra {block.identifier}</h2>
                          <p className='text-sm text-muted'>{block.development?.name ?? 'Sem empreendimento'} · {blockLots.length} lotes</p>
                        </div>
                        <span className='text-sm font-semibold text-muted'>{formatCurrency(blockLots.reduce((sum, lot) => sum + lot.price, 0))}</span>
                      </div>
                      <div className='grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-3'>
                        {blockLots.map((lot) => {
                          const meta = getStatusMeta(lot.status)
                          const selected = selectedLotId === lot.id
                          return (
                            <button
                              key={lot.id}
                              type='button'
                              onClick={() => selectLot(lot.id)}
                              className={`min-h-[86px] rounded-xl border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-primary ${meta.tile} ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                            >
                              <span className='block text-xs font-semibold opacity-75'>Lote</span>
                              <span className='mt-1 block text-lg font-bold'>{lot.identifier}</span>
                              <span className='mt-1 block truncate text-xs font-semibold'>{formatArea(lot.totalArea)}</span>
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            ) : (
              <div className='overflow-x-auto'>
                <table className='min-w-full divide-y divide-border'>
                  <thead className='bg-surface-secondary'>
                    <tr>
                      {[
                        ['identifier', 'Lote'],
                        ['block', 'Quadra'],
                        ['totalArea', 'Area'],
                        ['price', 'Valor'],
                        ['status', 'Status'],
                      ].map(([field, label]) => (
                        <th key={field} className='table-head px-6 py-4 text-left'>
                          <button onClick={() => toggleSort(field as SortField)} className='inline-flex items-center gap-1 transition hover:text-foreground'>
                            {label}
                            {sortBy === field && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-border bg-surface'>
                    {filteredLots.map((lot) => {
                      const meta = getStatusMeta(lot.status)
                      const selected = selectedLotId === lot.id
                      return (
                        <tr
                          key={lot.id}
                          onClick={() => selectLot(lot.id)}
                          className={`cursor-pointer transition hover:bg-surface-secondary/70 ${selected ? 'bg-primary/6' : ''}`}
                        >
                          <td className='px-6 py-4'>
                            <div className='flex items-center gap-3'>
                              <span className={`h-3 w-3 rounded-full ${meta.dot}`} />
                              <div>
                                <p className='text-sm font-semibold text-foreground'>Lote {lot.identifier}</p>
                                <p className='text-xs text-muted'>{lot.block.development?.name ?? 'Sem empreendimento'}</p>
                              </div>
                            </div>
                          </td>
                          <td className='px-6 py-4 text-sm font-medium text-foreground'>Quadra {lot.block.identifier}</td>
                          <td className='px-6 py-4 text-sm text-muted'>
                            <p className='font-semibold text-foreground'>{formatArea(lot.totalArea)}</p>
                            <p className='text-xs'>Frente {formatMeasurement(lot.front)} · Fundo {formatMeasurement(lot.back)}</p>
                          </td>
                          <td className='px-6 py-4 text-sm text-muted'>
                            <p className='font-semibold text-foreground'>{formatCurrency(lot.price)}</p>
                            <p className='text-xs'>{formatCurrency(lot.price / lot.totalArea)}/m2</p>
                          </td>
                          <td className='px-6 py-4'>
                            <span className={`pill ${meta.badge}`}>{meta.label}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <aside className='bg-surface px-6 py-6'>
            {selectedLot ? (
              <div className='space-y-6'>
                <div>
                  <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Lote selecionado</p>
                  <h2 className='mt-2 text-2xl font-bold text-foreground'>Quadra {selectedLot.block.identifier}, Lote {selectedLot.identifier}</h2>
                  <p className='mt-1 text-sm text-muted'>{selectedLot.block.development?.name ?? 'Sem empreendimento'}</p>
                </div>

                <div className='flex flex-wrap items-center gap-2'>
                  <span className={`pill ${getStatusMeta(selectedLot.status).badge}`}>{getStatusMeta(selectedLot.status).label}</span>
                  {selectedLot.sale?.contract && (
                    <span className='pill bg-emerald-50 text-emerald-700'>Contrato {selectedLot.sale.contract.contractNumber}</span>
                  )}
                </div>

                <div className='grid grid-cols-2 gap-3'>
                  <div className='rounded-xl border border-border bg-surface-secondary p-4'>
                    <p className='text-xs font-semibold uppercase text-muted'>Valor</p>
                    <p className='mt-2 text-lg font-bold text-foreground'>{formatCurrency(selectedLot.price)}</p>
                  </div>
                  <div className='rounded-xl border border-border bg-surface-secondary p-4'>
                    <p className='text-xs font-semibold uppercase text-muted'>Area</p>
                    <p className='mt-2 text-lg font-bold text-foreground'>{formatArea(selectedLot.totalArea)}</p>
                  </div>
                </div>

                {getLotContact(selectedLot) && (
                  <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                    <p className='text-xs font-semibold uppercase text-muted'>{getLotContact(selectedLot)?.label}</p>
                    <p className='mt-2 text-base font-semibold text-foreground'>{getLotContact(selectedLot)?.person.name}</p>
                    <p className='mt-1 text-sm text-muted'>{getLotContact(selectedLot)?.person.email}</p>
                    <Link href={`/clients`} className='mt-4 inline-flex rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-background'>
                      Ver clientes
                    </Link>
                  </div>
                )}

                {selectedLot.sale && (
                  <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                    <h3 className='text-sm font-semibold text-foreground'>Resumo da venda</h3>
                    <dl className='mt-4 grid grid-cols-2 gap-3 text-sm'>
                      <div>
                        <dt className='text-muted'>Total</dt>
                        <dd className='font-semibold text-foreground'>{formatCurrency(selectedLot.sale.totalValue)}</dd>
                      </div>
                      <div>
                        <dt className='text-muted'>Entrada</dt>
                        <dd className='font-semibold text-foreground'>{formatCurrency(selectedLot.sale.downPayment)}</dd>
                      </div>
                      <div>
                        <dt className='text-muted'>Parcelas</dt>
                        <dd className='font-semibold text-foreground'>{selectedLot.sale.installmentCount}x</dd>
                      </div>
                      <div>
                        <dt className='text-muted'>Valor/parcela</dt>
                        <dd className='font-semibold text-foreground'>{formatCurrency(selectedLot.sale.installmentValue)}</dd>
                      </div>
                    </dl>
                  </div>
                )}

                {getActiveReservation(selectedLot) && !selectedLot.sale && (
                  <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                    <div className='flex items-start justify-between gap-3'>
                      <div>
                        <h3 className='text-sm font-semibold text-foreground'>Reserva ativa</h3>
                        <p className='mt-1 text-xs font-semibold text-muted'>Criada em {formatDate(getActiveReservation(selectedLot)!.createdAt)}</p>
                      </div>
                      {isReservationExpired(getActiveReservation(selectedLot)) ? (
                        <span className='pill bg-red-50 text-red-700'>Vencida</span>
                      ) : (
                        <span className='pill bg-amber-50 text-amber-700'>Ativa</span>
                      )}
                    </div>
                    <p className='mt-2 text-sm leading-6 text-muted'>{getActiveReservation(selectedLot)?.proposal || 'Sem proposta registrada.'}</p>
                    {getActiveReservation(selectedLot)?.expiresAt && (
                      <p className='mt-3 text-sm font-semibold text-foreground'>Valida ate {formatDate(getActiveReservation(selectedLot)!.expiresAt!)}</p>
                    )}
                  </div>
                )}

                <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                  <h3 className='text-sm font-semibold text-foreground'>Medidas</h3>
                  <dl className='mt-4 grid grid-cols-2 gap-3 text-sm'>
                    <div>
                      <dt className='text-muted'>Frente</dt>
                      <dd className='font-semibold text-foreground'>{formatMeasurement(selectedLot.front)}</dd>
                    </div>
                    <div>
                      <dt className='text-muted'>Fundo</dt>
                      <dd className='font-semibold text-foreground'>{formatMeasurement(selectedLot.back)}</dd>
                    </div>
                    <div>
                      <dt className='text-muted'>Lateral esquerda</dt>
                      <dd className='font-semibold text-foreground'>{formatMeasurement(selectedLot.leftSide)}</dd>
                    </div>
                    <div>
                      <dt className='text-muted'>Lateral direita</dt>
                      <dd className='font-semibold text-foreground'>{formatMeasurement(selectedLot.rightSide)}</dd>
                    </div>
                  </dl>
                </div>

                <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                  <h3 className='text-sm font-semibold text-foreground'>Acoes</h3>
                  {reservationError && (
                    <div className='mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
                      {reservationError}
                    </div>
                  )}
                  <div className='mt-4 space-y-3'>
                    {selectedLot.status === 'available' && (
                      <>
                        <button className='w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong'>
                          Simular venda
                        </button>
                        <button onClick={openReservationForm} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-background'>
                          Reservar lote
                        </button>
                        <button className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-background'>
                          Bloquear lote
                        </button>
                      </>
                    )}

                    {(selectedLot.status === 'reserved' || selectedLot.status === 'on_hold') && (
                      <>
                        <button className='w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong'>
                          Converter em venda
                        </button>
                        <button className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-background'>
                          Simular nova condicao
                        </button>
                        <button onClick={cancelReservation} disabled={reservationSaving} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-background disabled:opacity-60'>
                          Liberar lote
                        </button>
                      </>
                    )}

                    {selectedLot.status === 'sold' && (
                      <>
                        <Link href='/sales' className='block w-full rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-primary-strong'>
                          Ver venda
                        </Link>
                        {selectedLot.sale?.contract && (
                          <Link href={`/api/contracts/${selectedLot.sale.id}/pdf`} className='block w-full rounded-xl border border-border bg-surface px-4 py-3 text-center text-sm font-semibold text-foreground transition hover:bg-background'>
                            Baixar contrato
                          </Link>
                        )}
                      </>
                    )}

                    <button className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-background'>
                      Ver historico
                    </button>
                  </div>

                  {showReservationForm && (
                    <div className='mt-5 rounded-2xl border border-border bg-surface p-4'>
                      <h4 className='text-sm font-semibold text-foreground'>Nova reserva</h4>
                      <div className='mt-4 space-y-4'>
                        <label className='block'>
                          <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Cliente</span>
                          <select
                            value={reservationForm.userId}
                            onChange={(event) => setReservationForm((current) => ({ ...current, userId: event.target.value }))}
                            className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                          >
                            <option value=''>Selecione...</option>
                            {clients.map((client) => (
                              <option key={client.id} value={client.id}>{client.name} · {client.email}</option>
                            ))}
                          </select>
                        </label>

                        <label className='block'>
                          <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Validade</span>
                          <input
                            type='date'
                            value={reservationForm.expiresAt}
                            onChange={(event) => setReservationForm((current) => ({ ...current, expiresAt: event.target.value }))}
                            className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                          />
                        </label>

                        <label className='block'>
                          <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Proposta/observacao</span>
                          <textarea
                            rows={3}
                            value={reservationForm.proposal}
                            onChange={(event) => setReservationForm((current) => ({ ...current, proposal: event.target.value }))}
                            className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                            placeholder='Condição conversada com o cliente'
                          />
                        </label>

                        <div className='flex gap-3'>
                          <button
                            onClick={saveReservation}
                            disabled={reservationSaving}
                            className='flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-60'
                          >
                            {reservationSaving ? 'Reservando...' : 'Confirmar reserva'}
                          </button>
                          <button
                            onClick={() => setShowReservationForm(false)}
                            disabled={reservationSaving}
                            className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-background disabled:opacity-60'
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                  <h3 className='text-sm font-semibold text-foreground'>Atividade recente</h3>
                  <div className='mt-4 space-y-3'>
                    <div className='rounded-xl border border-border bg-surface px-4 py-3'>
                      <p className='text-sm font-semibold text-foreground'>Lote cadastrado</p>
                      <p className='mt-1 text-xs text-muted'>{formatDate(selectedLot.createdAt)}</p>
                    </div>
                    {getActiveReservation(selectedLot) && (
                      <div className='rounded-xl border border-border bg-surface px-4 py-3'>
                        <p className='text-sm font-semibold text-foreground'>Reserva registrada</p>
                        <p className='mt-1 text-xs text-muted'>{formatDate(getActiveReservation(selectedLot)!.createdAt)}</p>
                      </div>
                    )}
                    {selectedLot.sale && (
                      <div className='rounded-xl border border-border bg-surface px-4 py-3'>
                        <p className='text-sm font-semibold text-foreground'>Venda registrada</p>
                        <p className='mt-1 text-xs text-muted'>{formatDate(selectedLot.sale.createdAt)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className='flex h-full min-h-[420px] flex-col items-center justify-center text-center'>
                <div className='flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-secondary text-muted'>
                  <svg className='h-7 w-7' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M4 6h16v12H4zM8 6v12M16 6v12M4 10h16M4 14h16' />
                  </svg>
                </div>
                <h2 className='mt-4 text-base font-semibold text-foreground'>Selecione um lote</h2>
                <p className='mt-2 text-sm leading-6 text-muted'>Clique em um lote no mapa ou em uma linha da lista para ver status, preco e medidas.</p>
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  )
}
