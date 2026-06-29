'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

type DevelopmentMap = {
  id: string
  fileUrl: string
  fileType: string
  pdfPageNumber: number
}

type Development = {
  id: string
  name: string
  map?: DevelopmentMap | null
}

type Lot = {
  id: string
  identifier: string
  totalArea: number
  price: number
  status: string
  mapXPercent?: number | null
  mapYPercent?: number | null
  block: {
    identifier: string
    development?: Development | null
  }
  sale?: {
    id: string
    user?: { name: string; email: string } | null
    contract?: { id: string; contractNumber: string; emailSent: boolean } | null
  } | null
  reservations: Array<{
    user?: { name: string; email: string } | null
    status: string
    cancelledAt?: string | null
    sale?: { id: string } | null
  }>
}

type StatusMeta = {
  label: string
  badge: string
  dot: string
}

type Marker = {
  xPercent: number | null
  yPercent: number | null
}

type StatusFilter = 'all' | 'available' | 'reserved' | 'sold' | 'on_hold'

type Props = {
  development: Development
  lots: Lot[]
  selectedLotId: string | null
  canManageMap: boolean
  onSelectLot: (lotId: string) => void
  onOpenLotDetails: (lotId: string) => void
  onReserveLot: (lotId: string) => void
  onSimulateLot: (lotId: string) => void
  onRefresh: () => Promise<void>
  getStatusMeta: (status: string) => StatusMeta
  formatCurrency: (value: number) => string
  formatArea: (value: number) => string
}

const acceptedPlanTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const maxPlanFileSize = 20 * 1024 * 1024
const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'available', label: 'Disponiveis' },
  { value: 'reserved', label: 'Reservados' },
  { value: 'sold', label: 'Vendidos' },
  { value: 'on_hold', label: 'Bloqueados' },
]

function compareNatural(a: string, b: string) {
  return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })
}

function markerKey(lot: Lot) {
  return `Quadra ${lot.block.identifier}, Lote ${lot.identifier}`
}

function hasMarker(marker?: Marker | null) {
  return marker?.xPercent !== null && marker?.xPercent !== undefined && marker?.yPercent !== null && marker?.yPercent !== undefined
}

function getActiveReservation(lot: Lot) {
  return lot.reservations.find((reservation) => !reservation.sale && reservation.status !== 'cancelled' && !reservation.cancelledAt) ?? null
}

function getEffectiveLotStatus(lot: Lot) {
  if (lot.sale || lot.status === 'sold') return 'sold'
  if (getActiveReservation(lot)) return 'reserved'
  return lot.status
}

export default function DevelopmentLotMap({
  development,
  lots,
  selectedLotId,
  canManageMap,
  onSelectLot,
  onOpenLotDetails,
  onReserveLot,
  onSimulateLot,
  onRefresh,
  getStatusMeta,
  formatCurrency,
  formatArea,
}: Props) {
  const mapAreaRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const dragStateRef = useRef<{ lotId: string | null; moved: boolean; startX: number; startY: number }>({
    lotId: null,
    moved: false,
    startX: 0,
    startY: 0,
  })
  const [currentMap, setCurrentMap] = useState<DevelopmentMap | null>(development.map ?? null)
  const [markers, setMarkers] = useState<Record<string, Marker>>({})
  const [editing, setEditing] = useState(false)
  const [selectedMarkerLotId, setSelectedMarkerLotId] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfRendering, setPdfRendering] = useState(false)
  const [mobileLotId, setMobileLotId] = useState<string | null>(null)
  const [mobileStatusFilter, setMobileStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    setCurrentMap(development.map ?? null)
  }, [development.map])

  useEffect(() => {
    setMarkers(Object.fromEntries(lots.map((lot) => [
      lot.id,
      {
        xPercent: lot.mapXPercent ?? null,
        yPercent: lot.mapYPercent ?? null,
      },
    ])))
  }, [lots])

  const sortedLots = useMemo(
    () => [...lots].sort((a, b) => {
      const block = compareNatural(a.block.identifier, b.block.identifier)
      return block === 0 ? compareNatural(a.identifier, b.identifier) : block
    }),
    [lots],
  )

  const positionedLots = useMemo(
    () => sortedLots.filter((lot) => hasMarker(markers[lot.id])),
    [markers, sortedLots],
  )

  const unpositionedLots = useMemo(
    () => sortedLots.filter((lot) => !hasMarker(markers[lot.id])),
    [markers, sortedLots],
  )
  const mobileLot = useMemo(
    () => sortedLots.find((lot) => lot.id === mobileLotId) ?? null,
    [mobileLotId, sortedLots],
  )
  const filteredPositionedLots = useMemo(
    () => positionedLots.filter((lot) => mobileStatusFilter === 'all' || getEffectiveLotStatus(lot) === mobileStatusFilter),
    [mobileStatusFilter, positionedLots],
  )
  const mapStats = useMemo(() => {
    const total = sortedLots.length
    const sold = sortedLots.filter((lot) => getEffectiveLotStatus(lot) === 'sold').length
    return {
      total,
      sold,
      available: sortedLots.filter((lot) => getEffectiveLotStatus(lot) === 'available').length,
      reserved: sortedLots.filter((lot) => getEffectiveLotStatus(lot) === 'reserved').length,
      soldPercentage: total > 0 ? sold / total : 0,
    }
  }, [sortedLots])
  const getStatusFilterCount = (status: StatusFilter) => {
    if (status === 'all') return mapStats.total
    if (status === 'available') return mapStats.available
    if (status === 'reserved') return mapStats.reserved
    if (status === 'sold') return mapStats.sold
    return sortedLots.filter((lot) => getEffectiveLotStatus(lot) === status).length
  }
  const mobileLotStatus = mobileLot ? getEffectiveLotStatus(mobileLot) : null
  const mobileLotMeta = mobileLotStatus ? getStatusMeta(mobileLotStatus) : null
  const mobileReservation = mobileLot ? getActiveReservation(mobileLot) : null
  const mobileContact = mobileLot?.sale?.user ?? mobileReservation?.user ?? null

  const getNextUnpositionedLotId = (currentLotId: string, nextMarkers: Record<string, Marker>) => {
    const withoutCurrent = sortedLots.filter((lot) => lot.id !== currentLotId && !hasMarker(nextMarkers[lot.id]))
    if (withoutCurrent.length === 0) return currentLotId

    const currentIndex = sortedLots.findIndex((lot) => lot.id === currentLotId)
    const afterCurrent = withoutCurrent.find((lot) => sortedLots.findIndex((candidate) => candidate.id === lot.id) > currentIndex)
    return (afterCurrent ?? withoutCurrent[0]).id
  }

  useEffect(() => {
    if (!selectedMarkerLotId) {
      setSelectedMarkerLotId(unpositionedLots[0]?.id ?? sortedLots[0]?.id ?? '')
    }
  }, [editing, selectedMarkerLotId, sortedLots, unpositionedLots])

  useEffect(() => {
    if (!mobileLot) return
    if (mobileStatusFilter !== 'all' && getEffectiveLotStatus(mobileLot) !== mobileStatusFilter) {
      setMobileLotId(null)
    }
  }, [mobileLot, mobileStatusFilter])

  useEffect(() => {
    let cancelled = false

    async function renderPdf() {
      if (!currentMap || currentMap.fileType !== 'pdf' || !canvasRef.current) return

      try {
        setPdfRendering(true)
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString()
        const document = await pdfjs.getDocument({ url: currentMap.fileUrl }).promise
        const page = await document.getPage(Math.min(Math.max(currentMap.pdfPageNumber || 1, 1), document.numPages))
        const viewport = page.getViewport({ scale: 1.6 })
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        if (!context || cancelled) return

        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvas, canvasContext: context, viewport }).promise
      } catch {
        if (!cancelled) setError('Nao foi possivel renderizar o PDF da planta.')
      } finally {
        if (!cancelled) setPdfRendering(false)
      }
    }

    void renderPdf()
    return () => {
      cancelled = true
    }
  }, [currentMap])

  const uploadPlan = async (file?: File) => {
    if (!file) return
    if (!acceptedPlanTypes.includes(file.type)) {
      setError('Use uma imagem PNG, JPG, WebP ou PDF.')
      return
    }
    if (file.size > maxPlanFileSize) {
      setError('A planta deve ter no maximo 20 MB.')
      return
    }

    try {
      setUploading(true)
      setError(null)
      const payload = new FormData()
      payload.append('file', file)
      payload.append('purpose', 'development-map')

      const uploadResponse = await fetch('/api/uploads', {
        method: 'POST',
        body: payload,
      })
      const uploadData = await uploadResponse.json()
      if (!uploadResponse.ok) throw new Error(uploadData.error || 'Nao foi possivel enviar a planta.')

      const mapResponse = await fetch(`/api/developments/${development.id}/map`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: uploadData.url, pdfPageNumber: 1 }),
      })
      const mapData = await mapResponse.json()
      if (!mapResponse.ok) throw new Error(mapData.error || 'Nao foi possivel salvar a planta.')

      setCurrentMap(mapData)
      setEditing(true)
      await onRefresh()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Nao foi possivel salvar a planta.')
    } finally {
      setUploading(false)
    }
  }

  const saveMarkers = async () => {
    try {
      setSaving(true)
      setError(null)
      const response = await fetch(`/api/developments/${development.id}/map/markers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markers: sortedLots.map((lot) => ({
            lotId: lot.id,
            xPercent: markers[lot.id]?.xPercent ?? null,
            yPercent: markers[lot.id]?.yPercent ?? null,
          })),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Nao foi possivel salvar as marcacoes.')

      setEditing(false)
      await onRefresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Nao foi possivel salvar as marcacoes.')
    } finally {
      setSaving(false)
    }
  }

  const placeMarker = (clientX: number, clientY: number) => {
    if (!editing || !selectedMarkerLotId || !mapAreaRef.current) return

    const rect = mapAreaRef.current.getBoundingClientRect()
    const xPercent = ((clientX - rect.left) / rect.width) * 100
    const yPercent = ((clientY - rect.top) / rect.height) * 100
    const lotId = selectedMarkerLotId
    const nextMarker = {
      xPercent: Math.max(0, Math.min(100, xPercent)),
      yPercent: Math.max(0, Math.min(100, yPercent)),
    }
    const nextMarkers = {
      ...markers,
      [lotId]: nextMarker,
    }

    setMarkers((current) => ({
      ...current,
      [lotId]: nextMarker,
    }))
    setSelectedMarkerLotId((currentLotId) => {
      if (currentLotId !== lotId) return currentLotId
      return getNextUnpositionedLotId(lotId, nextMarkers)
    })
  }

  const removeSelectedMarker = () => {
    if (!selectedMarkerLotId) return
    setMarkers((current) => ({
      ...current,
      [selectedMarkerLotId]: { xPercent: null, yPercent: null },
    }))
  }

  const removeAllMarkers = () => {
    if (!window.confirm('Remover todas as marcacoes da planta? A alteracao so sera aplicada depois de salvar.')) return
    setMarkers(Object.fromEntries(sortedLots.map((lot) => [
      lot.id,
      { xPercent: null, yPercent: null },
    ])))
    setSelectedMarkerLotId(sortedLots[0]?.id ?? '')
  }

  if (!currentMap) {
    return (
      <div className='rounded-2xl border border-dashed border-border bg-surface-secondary p-6'>
        <div className='max-w-2xl'>
          <h2 className='text-base font-semibold text-foreground'>Planta do empreendimento</h2>
          <p className='mt-2 text-sm leading-6 text-muted'>
            Envie a planta real para posicionar os lotes e acompanhar disponibilidade diretamente no desenho do loteamento.
          </p>
        </div>
        {canManageMap ? (
          <div className='mt-5'>
            <button
              type='button'
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-50'
            >
              {uploading ? 'Enviando...' : 'Enviar planta'}
            </button>
            <input
              ref={fileInputRef}
              type='file'
              accept={acceptedPlanTypes.join(',')}
              className='sr-only'
              onChange={(event) => {
                void uploadPlan(event.target.files?.[0])
                event.target.value = ''
              }}
            />
            <p className='mt-2 text-xs text-muted'>PNG, JPG, WebP ou PDF, ate 20 MB.</p>
            {error && <p className='mt-3 text-sm text-red-600'>{error}</p>}
          </div>
        ) : (
          <p className='mt-5 text-sm text-muted'>A planta ainda nao foi configurada por um administrador.</p>
        )}
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='space-y-3 rounded-2xl border border-border bg-surface-secondary p-3 md:hidden'>
        <div className='flex items-center justify-between gap-3 px-1'>
          <p className='text-xs font-semibold uppercase text-muted'>Status dos lotes</p>
          <p className='text-xs font-bold text-primary'>
            {new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 }).format(mapStats.soldPercentage)} vendido
          </p>
        </div>
        <div className='flex gap-2 overflow-x-auto pb-1'>
          {statusFilters.map((filter) => {
            const active = mobileStatusFilter === filter.value
            return (
              <button
                key={filter.value}
                type='button'
                onClick={() => setMobileStatusFilter(filter.value)}
                className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-surface text-muted'
                }`}
              >
                {filter.label} ({getStatusFilterCount(filter.value)})
              </button>
            )
          })}
        </div>
      </div>

      <div className='flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between'>
        <div className='hidden flex-wrap gap-3 md:flex'>
          {['available', 'reserved', 'on_hold', 'sold'].map((status) => {
            const meta = getStatusMeta(status)
            return (
              <div key={status} className='flex items-center gap-2 text-xs font-semibold text-muted'>
                <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </div>
            )
          })}
        </div>
        {canManageMap && (
          <div className='hidden flex-wrap gap-2 md:flex'>
            <button
              type='button'
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || saving}
              className='rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-surface-secondary disabled:opacity-50'
            >
              {uploading ? 'Enviando...' : 'Substituir planta'}
            </button>
            <button
              type='button'
              onClick={() => setEditing((current) => !current)}
              disabled={saving}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                editing ? 'border border-primary bg-primary/8 text-primary' : 'border border-border bg-surface text-foreground hover:bg-surface-secondary'
              }`}
            >
              {editing ? 'Sair da edicao' : 'Editar marcacoes'}
            </button>
            {editing && (
              <button
                type='button'
                onClick={() => void saveMarkers()}
                disabled={saving}
                className='rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-50'
              >
                {saving ? 'Salvando...' : 'Salvar marcacoes'}
              </button>
            )}
            <input
              ref={fileInputRef}
              type='file'
              accept={acceptedPlanTypes.join(',')}
              className='sr-only'
              onChange={(event) => {
                void uploadPlan(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </div>
        )}
      </div>

      {error && <div className='rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>{error}</div>}

      {editing && (
        <div className='hidden gap-3 rounded-2xl border border-border bg-surface-secondary p-4 md:grid lg:grid-cols-[minmax(220px,1fr)_auto] lg:items-start'>
          <label className='block'>
            <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Lote para marcar</span>
            <select
              value={selectedMarkerLotId}
              onChange={(event) => setSelectedMarkerLotId(event.target.value)}
              className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
            >
              {sortedLots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {markerKey(lot)}{hasMarker(markers[lot.id]) ? ' - marcado' : ' - sem pino'}
                </option>
              ))}
            </select>
            <span className='mt-2 block text-xs text-muted'>Clique na planta para marcar; o proximo lote sem pino sera selecionado automaticamente.</span>
          </label>
          <div className='grid gap-2 lg:pt-6'>
            <button
              type='button'
              onClick={removeSelectedMarker}
              disabled={!selectedMarkerLotId}
              className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-background disabled:opacity-50'
            >
              Remover pino
            </button>
            <button
              type='button'
              onClick={removeAllMarkers}
              disabled={positionedLots.length === 0}
              className='rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50'
            >
              Remover todos
            </button>
          </div>
        </div>
      )}

      <div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]'>
        <div className='overflow-auto rounded-2xl border border-border bg-surface-secondary p-3'>
          <div
            ref={mapAreaRef}
            role={editing ? 'button' : undefined}
            tabIndex={editing ? 0 : undefined}
            onClick={(event) => {
              if (event.target instanceof HTMLElement && event.target.closest('[data-lot-marker]')) return
              placeMarker(event.clientX, event.clientY)
            }}
            className={`relative mx-auto min-h-[420px] w-[calc(100vw-3rem)] min-w-[720px] max-w-6xl overflow-hidden rounded-xl bg-white shadow-sm md:w-full md:min-w-0 ${
              editing ? 'cursor-crosshair ring-2 ring-primary/30' : ''
            }`}
          >
            {currentMap.fileType === 'pdf' ? (
              <>
                {pdfRendering && (
                  <div className='absolute inset-0 z-10 flex items-center justify-center bg-white/80 text-sm font-semibold text-muted'>
                    Renderizando PDF...
                  </div>
                )}
                <canvas ref={canvasRef} className='block h-auto w-full' />
              </>
            ) : (
              <img src={currentMap.fileUrl} alt={`Planta de ${development.name}`} className='block h-auto w-full select-none' draggable={false} />
            )}

            {filteredPositionedLots.map((lot) => {
              const marker = markers[lot.id]
              const status = getEffectiveLotStatus(lot)
              const meta = getStatusMeta(status)
              const selected = selectedLotId === lot.id
              const editingSelected = editing && selectedMarkerLotId === lot.id

              return (
                <button
                  key={lot.id}
                  type='button'
                  data-lot-marker
                  onClick={(event) => {
                    event.stopPropagation()
                    if (editing) {
                      setSelectedMarkerLotId(lot.id)
                      return
                    }
                    if (window.matchMedia('(max-width: 767px)').matches) {
                      setMobileLotId(lot.id)
                      return
                    }
                    onSelectLot(lot.id)
                  }}
                  onPointerDown={(event) => {
                    if (!editing) return
                    dragStateRef.current = {
                      lotId: lot.id,
                      moved: false,
                      startX: event.clientX,
                      startY: event.clientY,
                    }
                    setSelectedMarkerLotId(lot.id)
                    event.currentTarget.setPointerCapture(event.pointerId)
                  }}
                  onPointerMove={(event) => {
                    if (!editing || !(event.buttons & 1)) return
                    if (
                      dragStateRef.current.lotId === lot.id &&
                      (Math.abs(event.clientX - dragStateRef.current.startX) > 3 ||
                        Math.abs(event.clientY - dragStateRef.current.startY) > 3)
                    ) {
                      dragStateRef.current.moved = true
                    }
                    setSelectedMarkerLotId(lot.id)
                    const rect = mapAreaRef.current?.getBoundingClientRect()
                    if (!rect) return
                    setMarkers((current) => ({
                      ...current,
                      [lot.id]: {
                        xPercent: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
                        yPercent: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
                      },
                    }))
                  }}
                  onPointerUp={(event) => {
                    if (!editing) return
                    event.stopPropagation()
                    dragStateRef.current = { lotId: null, moved: false, startX: 0, startY: 0 }
                  }}
                  aria-label={`${markerKey(lot)} - ${meta.label}`}
                  className={`absolute z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg transition before:absolute before:left-1/2 before:top-1/2 before:h-9 before:w-9 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] hover:scale-125 focus:outline-none focus:ring-2 focus:ring-primary md:before:h-5 md:before:w-5 ${
                    selected || editingSelected ? 'ring-2 ring-primary ring-offset-2' : ''
                  } ${meta.dot}`}
                  style={{
                    left: `${marker.xPercent ?? 0}%`,
                    top: `${marker.yPercent ?? 0}%`,
                  }}
                  title={`${markerKey(lot)} - ${meta.label}`}
                />
              )
            })}
          </div>
        </div>

        <aside className='hidden rounded-2xl border border-border bg-surface-secondary p-4 md:block'>
          <div>
            <p className='text-xs font-semibold uppercase text-muted'>Marcacoes</p>
            <p className='mt-1 text-2xl font-bold text-foreground'>{positionedLots.length}/{sortedLots.length}</p>
          </div>
          <div className='mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1'>
            {(editing ? unpositionedLots : positionedLots).slice(0, 80).map((lot) => {
              const meta = getStatusMeta(getEffectiveLotStatus(lot))
              return (
                <button
                  key={lot.id}
                  type='button'
                  onClick={() => {
                    setSelectedMarkerLotId(lot.id)
                    if (!editing) onSelectLot(lot.id)
                  }}
                  className={`block w-full rounded-xl border px-3 py-2 text-left transition hover:bg-background ${
                    editing && selectedMarkerLotId === lot.id
                      ? 'border-primary bg-primary/8'
                      : 'border-border bg-surface'
                  }`}
                >
                  <span className='flex items-center justify-between gap-2'>
                    <span className='text-sm font-semibold text-foreground'>{markerKey(lot)}</span>
                    <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                  </span>
                  <span className='mt-1 block text-xs text-muted'>{formatArea(lot.totalArea)} · {meta.label}</span>
                </button>
              )
            })}
            {editing && unpositionedLots.length === 0 && (
              <p className='rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700'>
                Todos os lotes tem pino na planta.
              </p>
            )}
          </div>
        </aside>
      </div>

      {mobileLot && mobileLotStatus && mobileLotMeta && (
        <>
          <button
            type='button'
            aria-label='Fechar lote selecionado'
            className='fixed inset-0 z-40 bg-slate-950/30 md:hidden'
            onClick={() => setMobileLotId(null)}
          />
          <section className='fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-border bg-surface p-4 shadow-2xl md:hidden'>
            <div className='mx-auto mb-3 h-1 w-10 rounded-full bg-border' />
            <div className='flex items-start justify-between gap-3'>
              <div>
                <p className='text-xs font-semibold uppercase text-muted'>Lote selecionado</p>
                <h3 className='mt-1 text-lg font-bold text-foreground'>{markerKey(mobileLot)}</h3>
                <p className='mt-1 text-sm text-muted'>{formatArea(mobileLot.totalArea)} · {formatCurrency(mobileLot.price)}</p>
                <p className='mt-1 text-xs font-semibold text-muted'>{formatCurrency(mobileLot.price / mobileLot.totalArea)}/m2</p>
              </div>
              <span className={`pill ${mobileLotMeta.badge}`}>
                {mobileLotMeta.label}
              </span>
            </div>

            {mobileContact && (
              <div className='mt-3 rounded-xl border border-border bg-surface-secondary px-3 py-2'>
                <p className='text-xs font-semibold uppercase text-muted'>{mobileLot.sale ? 'Comprador' : 'Cliente da reserva'}</p>
                <p className='mt-1 text-sm font-semibold text-foreground'>{mobileContact.name}</p>
                <p className='mt-0.5 text-xs text-muted'>{mobileContact.email}</p>
              </div>
            )}

            <div className='mt-4 grid gap-2'>
              {mobileLotStatus === 'available' && (
                <>
                  <button
                    type='button'
                    onClick={() => { setMobileLotId(null); onSimulateLot(mobileLot.id) }}
                    className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white'
                  >
                    Simular venda
                  </button>
                  <button
                    type='button'
                    onClick={() => { setMobileLotId(null); onReserveLot(mobileLot.id) }}
                    className='rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm font-semibold text-foreground'
                  >
                    Reservar lote
                  </button>
                </>
              )}
              {mobileLotStatus === 'reserved' && (
                <>
                  <button
                    type='button'
                    onClick={() => { setMobileLotId(null); onSimulateLot(mobileLot.id) }}
                    className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white'
                  >
                    Simular nova condicao
                  </button>
                  <button
                    type='button'
                    onClick={() => { setMobileLotId(null); onOpenLotDetails(mobileLot.id) }}
                    className='rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm font-semibold text-foreground'
                  >
                    Ver reserva
                  </button>
                </>
              )}
              {mobileLotStatus === 'sold' && (
                <>
                  <button
                    type='button'
                    onClick={() => { setMobileLotId(null); onOpenLotDetails(mobileLot.id) }}
                    className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white'
                  >
                    Ver venda
                  </button>
                  {mobileLot.sale?.contract && (
                    <Link
                      href={`/api/contracts/${mobileLot.sale.id}/pdf`}
                      className='rounded-xl border border-border bg-surface-secondary px-4 py-3 text-center text-sm font-semibold text-foreground'
                    >
                      Baixar contrato
                    </Link>
                  )}
                </>
              )}
              {mobileLotStatus === 'on_hold' && (
                <button
                  type='button'
                  onClick={() => { setMobileLotId(null); onOpenLotDetails(mobileLot.id) }}
                  className='rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm font-semibold text-foreground'
                >
                  Ver detalhes
                </button>
              )}
              <button
                type='button'
                onClick={() => { setMobileLotId(null); onOpenLotDetails(mobileLot.id) }}
                className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground'
              >
                Detalhes completos
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
