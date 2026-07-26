'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'

type Proposal = {
  id: string
  status: string
  canReview: boolean
  exceptionReasons?: string | null
  rejectionReason?: string | null
  salePrice: number
  downPayment: number
  installmentCount: number
  installmentValue: number
  balance: number
  totalValue: number
  createdAt: string
  reviewedAt?: string | null
  user: { id: string; name: string; email: string }
  createdBy: { id: string; name: string; email: string }
  reviewedBy?: { id: string; name: string; email: string } | null
  reservation?: { id: string } | null
  lot: {
    id: string
    identifier: string
    block: {
      identifier: string
      development?: { id: string; name: string } | null
    }
  }
}

type PublicLotInterest = {
  id: string
  name: string
  email: string
  phone: string
  notes?: string | null
  status: string
  createdAt: string
  lot: {
    id: string
    identifier: string
    status: string
    sale?: { id: string } | null
    reservations: Array<{ id: string }>
    block: {
      identifier: string
      development?: { id: string; name: string } | null
    }
  }
}

type Feedback = {
  type: 'success' | 'error'
  message: string
  developmentId?: string
}

const statusMeta: Record<string, { label: string; className: string }> = {
  pending_approval: { label: 'Aguardando aprovacao', className: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Aprovada', className: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Rejeitada', className: 'bg-red-50 text-red-700' },
  converted: { label: 'Convertida em venda', className: 'bg-blue-50 text-blue-700' },
}

const interestStatusMeta: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-amber-50 text-amber-700' },
  contacted: { label: 'Contactada', className: 'bg-sky-50 text-sky-700' },
  dismissed: { label: 'Descartada', className: 'bg-slate-100 text-slate-700' },
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function getLotAvailability(lot: PublicLotInterest['lot']) {
  if (lot.sale || lot.status === 'sold') return 'Vendido'
  if (lot.reservations.length > 0 || lot.status === 'reserved') return 'Reservado'
  if (lot.status === 'on_hold') return 'Bloqueado'
  return 'Disponivel'
}

function ProposalsContent() {
  const searchParams = useSearchParams()
  const developmentFilter = searchParams.get('developmentId') ?? ''
  const [viewMode, setViewMode] = useState<'interests' | 'proposals'>('interests')
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [interests, setInterests] = useState<PublicLotInterest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '')
  const [interestStatusFilter, setInterestStatusFilter] = useState('pending')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [updatingInterestId, setUpdatingInterestId] = useState<string | null>(null)
  const [rejectionId, setRejectionId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  async function fetchData() {
    try {
      setLoading(true)
      const [proposalResponse, interestResponse] = await Promise.all([
        fetch('/api/proposals', { cache: 'no-store' }),
        fetch('/api/public-lot-interests', { cache: 'no-store' }),
      ])
      if (!proposalResponse.ok) throw new Error('Nao foi possivel carregar as propostas.')
      if (!interestResponse.ok) throw new Error('Nao foi possivel carregar as solicitacoes publicas.')
      setProposals(await proposalResponse.json())
      setInterests(await interestResponse.json())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar propostas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
  }, [])

  useEffect(() => {
    setStatusFilter(searchParams.get('status') ?? '')
  }, [searchParams])

  useEffect(() => {
    setFeedback((current) => {
      if (!current || !developmentFilter) return current
      if (!current.developmentId) return null
      if (current.developmentId === developmentFilter) return current
      return null
    })
  }, [developmentFilter])

  const filteredProposals = useMemo(
    () => proposals
      .filter((proposal) => !developmentFilter || proposal.lot.block.development?.id === developmentFilter)
      .filter((proposal) => !statusFilter || proposal.status === statusFilter),
    [developmentFilter, proposals, statusFilter],
  )

  const filteredInterests = useMemo(
    () => interests
      .filter((interest) => !developmentFilter || interest.lot.block.development?.id === developmentFilter)
      .filter((interest) => !interestStatusFilter || interest.status === interestStatusFilter),
    [developmentFilter, interestStatusFilter, interests],
  )

  const interestsByLot = useMemo(() => {
    const map = new Map<string, { lot: PublicLotInterest['lot']; interests: PublicLotInterest[] }>()
    const sortedInterests = [...filteredInterests].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    sortedInterests.forEach((interest) => {
      const group = map.get(interest.lot.id)
      if (group) {
        group.interests.push(interest)
      } else {
        map.set(interest.lot.id, { lot: interest.lot, interests: [interest] })
      }
    })
    return Array.from(map.values()).sort((a, b) => (
      new Date(a.interests[0]?.createdAt ?? 0).getTime() - new Date(b.interests[0]?.createdAt ?? 0).getTime()
    ))
  }, [filteredInterests])

  const visibleFeedback = useMemo(() => {
    if (!feedback) return null
    if (developmentFilter && feedback.developmentId !== developmentFilter) return null
    return feedback
  }, [developmentFilter, feedback])

  async function reviewProposal(proposalId: string, action: 'approve' | 'reject') {
    const currentProposal = proposals.find((proposal) => proposal.id === proposalId)
    const feedbackDevelopmentId = currentProposal?.lot.block.development?.id ?? developmentFilter

    try {
      setReviewingId(proposalId)
      setError(null)
      setFeedback(null)
      const response = await fetch(`/api/proposals/${proposalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: action === 'reject' ? rejectionReason : undefined }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Nao foi possivel revisar a proposta.')
      setProposals((current) => current.map((proposal) => (
        proposal.id === payload.id ? { ...payload, canReview: proposal.canReview } : proposal
      )))
      setRejectionId(null)
      setRejectionReason('')
      setFeedback({
        type: 'success',
        message: action === 'approve' ? 'Proposta aprovada com sucesso.' : 'Proposta rejeitada com sucesso.',
        developmentId: feedbackDevelopmentId,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel revisar a proposta.'
      setError(message)
      setFeedback({ type: 'error', message, developmentId: feedbackDevelopmentId })
    } finally {
      setReviewingId(null)
    }
  }

  async function updateInterestStatus(interestId: string, status: 'pending' | 'contacted' | 'dismissed') {
    const currentInterest = interests.find((interest) => interest.id === interestId)
    const feedbackDevelopmentId = currentInterest?.lot.block.development?.id ?? developmentFilter

    try {
      setUpdatingInterestId(interestId)
      setError(null)
      setFeedback(null)
      const response = await fetch(`/api/public-lot-interests/${interestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Nao foi possivel atualizar a solicitacao.')
      setInterests((current) => current.map((interest) => (interest.id === payload.id ? payload : interest)))
      setFeedback({
        type: 'success',
        message: 'Solicitacao atualizada.',
        developmentId: feedbackDevelopmentId,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel atualizar a solicitacao.'
      setError(message)
      setFeedback({ type: 'error', message, developmentId: feedbackDevelopmentId })
    } finally {
      setUpdatingInterestId(null)
    }
  }

  if (loading) return <div className='h-72 animate-pulse rounded-2xl bg-surface-secondary' />

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='page-title'>Funil comercial</h1>
          <p className='page-subtitle'>Acompanhe solicitacoes do mapa publico, aprovacoes comerciais e continuidade das vendas.</p>
        </div>
        <div className='flex flex-col gap-3 sm:flex-row'>
          <div className='inline-flex rounded-xl border border-border bg-surface p-1'>
            <button
              type='button'
              onClick={() => setViewMode('interests')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${viewMode === 'interests' ? 'bg-primary text-white' : 'text-muted hover:bg-surface-secondary'}`}
            >
              Solicitacoes ({filteredInterests.length})
            </button>
            <button
              type='button'
              onClick={() => setViewMode('proposals')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${viewMode === 'proposals' ? 'bg-primary text-white' : 'text-muted hover:bg-surface-secondary'}`}
            >
              Propostas ({filteredProposals.length})
            </button>
          </div>
          {viewMode === 'interests' ? (
            <select
              value={interestStatusFilter}
              onChange={(event) => setInterestStatusFilter(event.target.value)}
              className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground'
            >
              <option value=''>Todos os status</option>
              <option value='pending'>Pendentes</option>
              <option value='contacted'>Contactadas</option>
              <option value='dismissed'>Descartadas</option>
            </select>
          ) : (
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground'
            >
              <option value=''>Todos os status</option>
              <option value='pending_approval'>Aguardando aprovacao</option>
              <option value='approved'>Aprovadas</option>
              <option value='rejected'>Rejeitadas</option>
              <option value='converted'>Convertidas em venda</option>
            </select>
          )}
        </div>
      </div>

      {error && <div className='rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>{error}</div>}

      {visibleFeedback && (
        <div
          role={visibleFeedback.type === 'error' ? 'alert' : 'status'}
          aria-live='polite'
          className={`fixed right-4 top-24 z-[70] flex max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl ${
            visibleFeedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <p className='flex-1 text-sm font-semibold'>{visibleFeedback.message}</p>
          <button
            type='button'
            onClick={() => setFeedback(null)}
            className='text-xs font-bold uppercase'
            aria-label='Fechar mensagem'
          >
            Fechar
          </button>
        </div>
      )}

      {viewMode === 'interests' ? (
        interestsByLot.length === 0 ? (
          <div className='panel px-6 py-12 text-center text-sm text-muted'>Nenhuma solicitacao publica encontrada neste filtro.</div>
        ) : (
          <div className='grid gap-4'>
            {interestsByLot.map(({ lot, interests: lotInterests }) => (
              <article key={lot.id} className='panel p-6'>
                <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
                  <div>
                    <div className='flex flex-wrap items-center gap-2'>
                      <span className='pill bg-sky-50 text-sky-700'>{lotInterests.length} na fila</span>
                      <span className='pill bg-surface-secondary text-muted'>{getLotAvailability(lot)}</span>
                    </div>
                    <h2 className='mt-3 text-lg font-bold text-foreground'>
                      {lot.block.development?.name ?? 'Empreendimento'} · Quadra {lot.block.identifier}, Lote {lot.identifier}
                    </h2>
                  </div>
                  <Link
                    href={`/lots?developmentId=${lot.block.development?.id ?? developmentFilter}&lotId=${lot.id}`}
                    className='rounded-xl border border-border bg-surface px-4 py-3 text-center text-sm font-semibold text-foreground transition hover:bg-background'
                  >
                    Ver lote
                  </Link>
                </div>

                <div className='mt-5 grid gap-3'>
                  {lotInterests.map((interest, index) => {
                    const meta = interestStatusMeta[interest.status] ?? { label: interest.status, className: 'bg-surface-secondary text-muted' }
                    return (
                      <div key={interest.id} className='rounded-2xl border border-border bg-surface-secondary p-4'>
                        <div className='flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between'>
                          <div className='min-w-0'>
                            <div className='flex flex-wrap items-center gap-2'>
                              <span className={`pill ${meta.className}`}>{meta.label}</span>
                              <span className='text-xs font-semibold text-muted'>#{index + 1} · {formatDate(interest.createdAt)}</span>
                            </div>
                            <p className='mt-3 text-sm font-semibold text-foreground'>{interest.name}</p>
                            <p className='mt-1 text-sm text-muted'>{interest.email} · {formatPhone(interest.phone)}</p>
                            {interest.notes && <p className='mt-3 rounded-xl bg-surface px-4 py-3 text-sm leading-6 text-muted'>{interest.notes}</p>}
                          </div>
                          <div className='flex shrink-0 flex-col gap-2 sm:flex-row xl:flex-col'>
                            {interest.status !== 'contacted' && (
                              <button
                                type='button'
                                onClick={() => void updateInterestStatus(interest.id, 'contacted')}
                                disabled={updatingInterestId === interest.id}
                                className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-60'
                              >
                                Marcar contato
                              </button>
                            )}
                            {interest.status !== 'dismissed' && (
                              <button
                                type='button'
                                onClick={() => void updateInterestStatus(interest.id, 'dismissed')}
                                disabled={updatingInterestId === interest.id}
                                className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-background disabled:opacity-60'
                              >
                                Descartar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </article>
            ))}
          </div>
        )
      ) : filteredProposals.length === 0 ? (
        <div className='panel px-6 py-12 text-center text-sm text-muted'>Nenhuma proposta encontrada neste filtro.</div>
      ) : (
        <div className='grid gap-4'>
          {filteredProposals.map((proposal) => {
            const meta = statusMeta[proposal.status] ?? { label: proposal.status, className: 'bg-surface-secondary text-muted' }
            const isFocused = searchParams.get('proposalId') === proposal.id
            return (
              <article key={proposal.id} className={`panel p-6 ${isFocused ? 'ring-2 ring-primary' : ''}`}>
                <div className='flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between'>
                  <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <span className={`pill ${meta.className}`}>{meta.label}</span>
                      <span className='text-xs font-semibold text-muted'>{formatDate(proposal.createdAt)}</span>
                    </div>
                    <h2 className='mt-3 text-lg font-bold text-foreground'>
                      {proposal.lot.block.development?.name ?? 'Empreendimento'} · Quadra {proposal.lot.block.identifier}, Lote {proposal.lot.identifier}
                    </h2>
                    <p className='mt-1 text-sm text-muted'>
                      Cliente: <span className='font-semibold text-foreground'>{proposal.user.name}</span> · Enviada por {proposal.createdBy.name}
                    </p>
                    <div className='mt-4 flex flex-wrap gap-2 text-sm'>
                      <span className='rounded-xl bg-surface-secondary px-3 py-2'>Entrada {formatCurrency(proposal.downPayment)}</span>
                      <span className='rounded-xl bg-surface-secondary px-3 py-2'>Valor {formatCurrency(proposal.balance)}</span>
                      <span className='rounded-xl bg-surface-secondary px-3 py-2'>{proposal.installmentCount}x de {formatCurrency(proposal.installmentValue)}</span>
                    </div>
                    {proposal.exceptionReasons && (
                      <div className='mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'>
                        <p className='font-semibold'>Excecoes para revisar</p>
                        <p className='mt-1 whitespace-pre-line'>{proposal.exceptionReasons}</p>
                      </div>
                    )}
                    {proposal.rejectionReason && (
                      <div className='mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
                        Motivo: {proposal.rejectionReason}
                      </div>
                    )}
                  </div>

                  <div className='flex shrink-0 flex-col gap-2 sm:flex-row xl:flex-col'>
                    {proposal.status === 'approved' && (
                      <Link
                        href={`/sales?developmentId=${proposal.lot.block.development?.id ?? developmentFilter}&lotId=${proposal.lot.id}&userId=${proposal.user.id}&reservationId=${proposal.reservation?.id ?? ''}&proposalId=${proposal.id}`}
                        className='rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-primary-strong'
                      >
                        Continuar venda
                      </Link>
                    )}
                    {proposal.canReview && proposal.status === 'pending_approval' && (
                      <>
                        <button
                          type='button'
                          disabled={reviewingId === proposal.id}
                          onClick={() => void reviewProposal(proposal.id, 'approve')}
                          className='rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60'
                        >
                          {reviewingId === proposal.id ? 'Aprovando...' : 'Aprovar'}
                        </button>
                        <button
                          type='button'
                          disabled={reviewingId === proposal.id}
                          onClick={() => setRejectionId(proposal.id)}
                          className='rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60'
                        >
                          Rejeitar
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {rejectionId === proposal.id && (
                  <div className='mt-5 flex flex-col gap-3 border-t border-border pt-5 md:flex-row'>
                    <input
                      value={rejectionReason}
                      onChange={(event) => setRejectionReason(event.target.value)}
                      placeholder='Informe o motivo da rejeicao'
                      className='min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground'
                    />
                    <button
                      type='button'
                      disabled={!rejectionReason.trim() || reviewingId === proposal.id}
                      onClick={() => void reviewProposal(proposal.id, 'reject')}
                      className='rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60'
                    >
                      {reviewingId === proposal.id ? 'Rejeitando...' : 'Confirmar rejeicao'}
                    </button>
                    <button
                      type='button'
                      onClick={() => { setRejectionId(null); setRejectionReason('') }}
                      className='rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground'
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function ProposalsPage() {
  return (
    <Suspense fallback={<div className='h-72 animate-pulse rounded-2xl bg-surface-secondary' />}>
      <ProposalsContent />
    </Suspense>
  )
}
