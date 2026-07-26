'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type DevelopmentMap = {
  id: string
  fileUrl: string
  fileType: string
  pdfPageNumber: number
}

type PublicLot = {
  id: string
  identifier: string
  totalArea: number
  price: number | null
  status: string
  interestCount: number
  mapXPercent?: number | null
  mapYPercent?: number | null
  block: {
    id: string
    identifier: string
  }
}

type PublicMapPayload = {
  development: {
    id: string
    name: string
    logo?: string | null
    showPrices: boolean
  }
  map: DevelopmentMap
  lots: PublicLot[]
}

type SubmitState = {
  type: 'success' | 'error'
  message: string
  lotId?: string
  queuePosition?: number
} | null

const statusMeta: Record<string, { label: string; color: string; badge: string; text: string }> = {
  available: {
    label: 'Disponivel',
    color: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700',
    text: 'Disponivel para registrar interesse.',
  },
  requested: {
    label: 'Fila de interesse',
    color: 'bg-sky-500',
    badge: 'bg-sky-50 text-sky-700',
    text: 'Este lote ja tem solicitacao em analise. Voce pode registrar seu interesse para entrar na fila.',
  },
  reserved: {
    label: 'Reservado',
    color: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700',
    text: 'Este lote esta reservado no momento.',
  },
  sold: {
    label: 'Vendido',
    color: 'bg-red-500',
    badge: 'bg-red-50 text-red-700',
    text: 'Este lote ja foi vendido.',
  },
  on_hold: {
    label: 'Bloqueado',
    color: 'bg-slate-500',
    badge: 'bg-slate-100 text-slate-700',
    text: 'Este lote esta temporariamente indisponivel.',
  },
}

function hasMarker(lot: PublicLot) {
  return lot.mapXPercent !== null && lot.mapXPercent !== undefined && lot.mapYPercent !== null && lot.mapYPercent !== undefined
}

function lotLabel(lot: PublicLot) {
  return `Quadra ${lot.block.identifier}, Lote ${lot.identifier}`
}

function compareNatural(a: string, b: string) {
  return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })
}

function formatCurrency(value: number | null) {
  if (value === null) return null
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatArea(value: number) {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)} m2`
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export default function PublicDevelopmentMapPage({ token }: { token: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [payload, setPayload] = useState<PublicMapPayload | null>(null)
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [pdfRendering, setPdfRendering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitState, setSubmitState] = useState<SubmitState>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' })

  const fetchMap = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true)
      const response = await fetch(`/api/public/developments/${token}/map`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Mapa indisponivel.')
      setPayload(data)
      setError(null)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Mapa indisponivel.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchMap(true)
    const interval = window.setInterval(() => void fetchMap(), 10000)
    return () => window.clearInterval(interval)
  }, [token])

  useEffect(() => {
    let cancelled = false

    async function renderPdf() {
      if (!payload?.map || payload.map.fileType !== 'pdf' || !canvasRef.current) return

      try {
        setPdfRendering(true)
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString()
        const document = await pdfjs.getDocument({ url: payload.map.fileUrl }).promise
        const page = await document.getPage(Math.min(Math.max(payload.map.pdfPageNumber || 1, 1), document.numPages))
        const viewport = page.getViewport({ scale: 1.6 })
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        if (!context || cancelled) return

        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvas, canvasContext: context, viewport }).promise
      } catch {
        if (!cancelled) setError('Nao foi possivel carregar a planta.')
      } finally {
        if (!cancelled) setPdfRendering(false)
      }
    }

    void renderPdf()
    return () => {
      cancelled = true
    }
  }, [payload?.map])

  const lots = useMemo(
    () => [...(payload?.lots ?? [])].sort((a, b) => {
      const block = compareNatural(a.block.identifier, b.block.identifier)
      return block === 0 ? compareNatural(a.identifier, b.identifier) : block
    }),
    [payload?.lots],
  )
  const positionedLots = useMemo(() => lots.filter(hasMarker), [lots])
  const filteredLots = useMemo(
    () => positionedLots.filter((lot) => statusFilter === 'all' || lot.status === statusFilter),
    [positionedLots, statusFilter],
  )
  const selectedLot = useMemo(
    () => lots.find((lot) => lot.id === selectedLotId) ?? null,
    [lots, selectedLotId],
  )
  const selectedMeta = selectedLot ? statusMeta[selectedLot.status] ?? statusMeta.on_hold : null
  const canRequest = selectedLot?.status === 'available' || selectedLot?.status === 'requested'
  const selectedLotSubmitState = selectedLot && submitState?.lotId === selectedLot.id ? submitState : null

  const counts = useMemo(() => {
    return lots.reduce<Record<string, number>>((acc, lot) => {
      acc[lot.status] = (acc[lot.status] ?? 0) + 1
      acc.all = (acc.all ?? 0) + 1
      return acc
    }, { all: 0 })
  }, [lots])

  const submitInterest = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedLot) return

    try {
      setSubmitting(true)
      setSubmitState(null)
      const response = await fetch(`/api/public/developments/${token}/map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lotId: selectedLot.id, ...form }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Nao foi possivel registrar seu interesse.')
      setSubmitState({
        type: 'success',
        message: data.message || 'Solicitacao recebida com sucesso.',
        lotId: selectedLot.id,
        queuePosition: data.queuePosition,
      })
      setForm({ name: '', email: '', phone: '', notes: '' })
      await fetchMap()
    } catch (submitError) {
      setSubmitState({
        type: 'error',
        message: submitError instanceof Error ? submitError.message : 'Nao foi possivel registrar seu interesse.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && !payload) {
    return (
      <main className='flex min-h-screen items-center justify-center bg-background px-6'>
        <p className='text-sm font-semibold text-muted'>Carregando mapa...</p>
      </main>
    )
  }

  if (error && !payload) {
    return (
      <main className='flex min-h-screen items-center justify-center bg-background px-6 text-center'>
        <div>
          <h1 className='text-xl font-bold text-foreground'>Mapa indisponivel</h1>
          <p className='mt-2 text-sm text-muted'>{error}</p>
        </div>
      </main>
    )
  }

  return (
    <main className='min-h-screen bg-background text-foreground'>
      <header className='border-b border-border bg-white'>
        <div className='mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8'>
          <div className='flex min-w-0 items-center gap-3'>
            <div className='flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-secondary'>
              {payload?.development.logo ? (
                <img src={payload.development.logo} alt='' className='h-full w-full object-contain p-1.5' />
              ) : (
                <span className='text-sm font-bold text-primary'>{payload?.development.name.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className='min-w-0'>
              <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Disponibilidade</p>
              <h1 className='truncate text-xl font-bold text-foreground'>{payload?.development.name}</h1>
            </div>
          </div>
          <div className='flex flex-wrap gap-2'>
            {(['all', 'available', 'requested', 'reserved', 'sold'] as const).map((status) => {
              const active = statusFilter === status
              const label = status === 'all' ? 'Todos' : statusMeta[status].label
              return (
                <button
                  key={status}
                  type='button'
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    active ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-muted hover:bg-surface-secondary'
                  }`}
                >
                  {label} ({counts[status] ?? 0})
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <div className='mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8'>
        <section className='min-w-0'>
          {error && (
            <div className='mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'>
              {error}
            </div>
          )}
          <div className='overflow-auto rounded-xl border border-border bg-surface-secondary p-3'>
            <div className='relative mx-auto min-h-[420px] w-[calc(100vw-2rem)] min-w-[720px] max-w-6xl overflow-hidden rounded-lg bg-white shadow-sm md:w-full md:min-w-0'>
              {payload?.map.fileType === 'pdf' ? (
                <>
                  {pdfRendering && (
                    <div className='absolute inset-0 z-10 flex items-center justify-center bg-white/80 text-sm font-semibold text-muted'>
                      Carregando planta...
                    </div>
                  )}
                  <canvas ref={canvasRef} className='block h-auto w-full' />
                </>
              ) : (
                <img src={payload?.map.fileUrl} alt={`Planta de ${payload?.development.name}`} className='block h-auto w-full select-none' draggable={false} />
              )}

              {filteredLots.map((lot) => {
                const meta = statusMeta[lot.status] ?? statusMeta.on_hold
                const selected = selectedLotId === lot.id
                return (
                  <button
                    key={lot.id}
                    type='button'
                    onClick={() => { setSelectedLotId(lot.id); setSubmitState(null) }}
                    aria-label={`${lotLabel(lot)} - ${meta.label}`}
                    className={`absolute z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg transition before:absolute before:left-1/2 before:top-1/2 before:h-9 before:w-9 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] hover:scale-125 focus:outline-none focus:ring-2 focus:ring-primary md:before:h-5 md:before:w-5 ${
                      selected ? 'ring-2 ring-primary ring-offset-2' : ''
                    } ${meta.color}`}
                    style={{ left: `${lot.mapXPercent ?? 0}%`, top: `${lot.mapYPercent ?? 0}%` }}
                    title={`${lotLabel(lot)} - ${meta.label}`}
                  />
                )
              })}
            </div>
          </div>
        </section>

        <aside className='rounded-xl border border-border bg-surface p-4 shadow-sm lg:sticky lg:top-5 lg:max-h-[calc(100vh-2.5rem)] lg:overflow-y-auto'>
          {!selectedLot || !selectedMeta ? (
            <div className='py-8 text-center'>
              <p className='text-sm font-semibold text-foreground'>Selecione um lote na planta</p>
              <p className='mt-2 text-sm leading-6 text-muted'>Ao tocar em um marcador, voce ve os detalhes e pode registrar interesse nos lotes disponiveis.</p>
            </div>
          ) : (
            <div>
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <p className='text-xs font-semibold uppercase text-muted'>Lote selecionado</p>
                  <h2 className='mt-1 text-lg font-bold text-foreground'>{lotLabel(selectedLot)}</h2>
                  <p className='mt-1 text-sm text-muted'>{formatArea(selectedLot.totalArea)}</p>
                  {formatCurrency(selectedLot.price) && (
                    <p className='mt-1 text-sm font-semibold text-foreground'>{formatCurrency(selectedLot.price)}</p>
                  )}
                </div>
                <span className={`pill ${selectedMeta.badge}`}>{selectedMeta.label}</span>
              </div>

              <div className='mt-4 rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm leading-6 text-muted'>
                  {selectedLot.status === 'requested' && selectedLot.interestCount > 0
                  ? selectedLotSubmitState?.type === 'success'
                    ? 'Sua solicitacao foi recebida. Nossa equipe vai analisar e entrar em contato.'
                    : selectedLot.interestCount === 1
                      ? 'Este lote tem 1 solicitacao em analise. Voce pode registrar seu interesse para entrar na fila.'
                      : `Este lote tem ${selectedLot.interestCount} solicitacoes em analise. Voce pode registrar seu interesse para entrar na fila.`
                  : selectedMeta.text}
              </div>

              {canRequest ? (
                <form onSubmit={submitInterest} className='mt-5 space-y-3'>
                  <label className='block'>
                    <span className='mb-1.5 block text-sm font-semibold text-foreground'>Nome</span>
                    <input
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-primary'
                      required
                    />
                  </label>
                  <label className='block'>
                    <span className='mb-1.5 block text-sm font-semibold text-foreground'>E-mail</span>
                    <input
                      type='email'
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-primary'
                      required
                    />
                  </label>
                  <label className='block'>
                    <span className='mb-1.5 block text-sm font-semibold text-foreground'>WhatsApp</span>
                    <input
                      value={form.phone}
                      onChange={(event) => setForm((current) => ({ ...current, phone: formatPhone(event.target.value) }))}
                      className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-primary'
                      inputMode='tel'
                      placeholder='(00) 00000-0000'
                      required
                    />
                  </label>
                  <label className='block'>
                    <span className='mb-1.5 block text-sm font-semibold text-foreground'>Observacao</span>
                    <textarea
                      value={form.notes}
                      onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                      className='min-h-24 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-primary'
                    />
                  </label>

                  {submitState && (
                    <div className={`rounded-xl border px-4 py-3 text-sm ${
                      submitState.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-red-200 bg-red-50 text-red-700'
                    }`}>
                      {submitState.message}
                      {submitState.queuePosition === 1 && (
                        <span className='mt-1 block font-semibold'>Voce e o primeiro da fila.</span>
                      )}
                      {submitState.queuePosition && submitState.queuePosition > 1 && (
                        <span className='mt-1 block font-semibold'>Voce esta na posicao {submitState.queuePosition} da fila.</span>
                      )}
                    </div>
                  )}

                  <button
                    type='submit'
                    disabled={submitting}
                    className='w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-60'
                  >
                    {submitting ? 'Registrando...' : selectedLot.status === 'requested' ? 'Entrar na fila' : 'Registrar interesse'}
                  </button>
                </form>
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}
