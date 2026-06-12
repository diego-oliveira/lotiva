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

const statusMeta: Record<string, { label: string; className: string }> = {
  pending_approval: { label: 'Aguardando aprovacao', className: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Aprovada', className: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Rejeitada', className: 'bg-red-50 text-red-700' },
  converted: { label: 'Convertida em venda', className: 'bg-blue-50 text-blue-700' },
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function ProposalsContent() {
  const searchParams = useSearchParams()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [rejectionId, setRejectionId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  async function fetchData() {
    try {
      setLoading(true)
      const proposalResponse = await fetch('/api/proposals', { cache: 'no-store' })
      if (!proposalResponse.ok) throw new Error('Nao foi possivel carregar as propostas.')
      setProposals(await proposalResponse.json())
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

  const filteredProposals = useMemo(
    () => proposals.filter((proposal) => !statusFilter || proposal.status === statusFilter),
    [proposals, statusFilter],
  )

  async function reviewProposal(proposalId: string, action: 'approve' | 'reject') {
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
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel revisar a proposta.'
      setError(message)
      setFeedback({ type: 'error', message })
    } finally {
      setReviewingId(null)
    }
  }

  if (loading) return <div className='h-72 animate-pulse rounded-2xl bg-surface-secondary' />

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='page-title'>Propostas</h1>
          <p className='page-subtitle'>Acompanhe aprovacoes automaticas, excecoes comerciais e continuidade das vendas.</p>
        </div>
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
      </div>

      {error && <div className='rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>{error}</div>}

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          aria-live='polite'
          className={`fixed right-4 top-24 z-[70] flex max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <p className='flex-1 text-sm font-semibold'>{feedback.message}</p>
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

      {filteredProposals.length === 0 ? (
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
                      <span className='rounded-xl bg-surface-secondary px-3 py-2'>Venda {formatCurrency(proposal.salePrice)}</span>
                      <span className='rounded-xl bg-surface-secondary px-3 py-2'>Entrada {formatCurrency(proposal.downPayment)}</span>
                      <span className='rounded-xl bg-surface-secondary px-3 py-2'>{proposal.installmentCount}x de {formatCurrency(proposal.installmentValue)}</span>
                      <span className='rounded-xl bg-surface-secondary px-3 py-2'>Total {formatCurrency(proposal.totalValue)}</span>
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
                        href={`/sales?lotId=${proposal.lot.id}&userId=${proposal.user.id}&reservationId=${proposal.reservation?.id ?? ''}&proposalId=${proposal.id}`}
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
