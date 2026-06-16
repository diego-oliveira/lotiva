'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Connection = {
  id: string
  environment: string
  status: string
  webhookStatus: string | null
  lastWebhookAt: string | null
  lastRun: {
    status: string
    checkedCount: number
    divergenceCount: number
    resolvedCount: number
    startedAt: string
  } | null
}

export default function PaymentOperationsPanel({
  connections,
  failedWebhooks,
  pendingDivergences,
  canReconcile,
  failedEvents,
  divergences,
}: {
  connections: Connection[]
  failedWebhooks: number
  pendingDivergences: number
  canReconcile: boolean
  failedEvents: Array<{ id: string; eventType: string; errorMessage: string | null; createdAt: string }>
  divergences: Array<{ id: string; type: string; resolution: string | null; createdAt: string }>
}) {
  const router = useRouter()
  const [runningId, setRunningId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const reconcile = async (connectionId: string) => {
    setRunningId(connectionId)
    setMessage(null)
    try {
      const response = await fetch('/api/finance/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Nao foi possivel executar a conciliacao.')
      setMessage(`Conciliacao concluida: ${payload.checkedCount} cobranca(s), ${payload.divergenceCount} divergencia(s).`)
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel executar a conciliacao.')
    } finally {
      setRunningId(null)
    }
  }

  const retryWebhook = async (eventId: string) => {
    setRunningId(eventId)
    setMessage(null)
    try {
      const response = await fetch(`/api/finance/webhooks/${eventId}/retry`, { method: 'POST' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Nao foi possivel reprocessar o webhook.')
      setMessage(`Webhook reprocessado: ${payload.processed} processado(s), ${payload.failed} falha(s).`)
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel reprocessar o webhook.')
    } finally {
      setRunningId(null)
    }
  }

  return (
    <section className='panel overflow-hidden'>
      <div className='panel-header px-6 py-5'>
        <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <h2 className='text-lg font-semibold text-foreground'>Operacao Asaas</h2>
            <p className='mt-1 text-sm text-muted'>Saude dos webhooks e confirmacao periodica das cobrancas.</p>
          </div>
          <div className='flex gap-2'>
            <span className={`pill ${failedWebhooks ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {failedWebhooks} webhook(s) com falha
            </span>
            <span className={`pill ${pendingDivergences ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {pendingDivergences} divergencia(s) pendente(s)
            </span>
          </div>
        </div>
      </div>
      {message && <div className='border-b border-border bg-blue-50 px-6 py-3 text-sm text-blue-800'>{message}</div>}
      {connections.length === 0 ? (
        <div className='px-6 py-6 text-sm text-muted'>Nenhuma conexao Asaas ativa para esta empresa.</div>
      ) : (
        <div className='divide-y divide-border'>
          {connections.map((connection) => (
            <div key={connection.id} className='flex flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between'>
              <div>
                <div className='flex flex-wrap items-center gap-2'>
                  <p className='text-sm font-semibold text-foreground'>
                    {connection.environment === 'production' ? 'Producao' : 'Sandbox'}
                  </p>
                  <span className={`pill ${connection.webhookStatus === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    Webhook {connection.webhookStatus === 'active' ? 'ativo' : connection.webhookStatus || 'nao configurado'}
                  </span>
                </div>
                <p className='mt-1 text-xs text-muted'>
                  {connection.lastRun
                    ? `Ultima conciliacao em ${new Date(connection.lastRun.startedAt).toLocaleString('pt-BR')}: ${connection.lastRun.checkedCount} verificadas, ${connection.lastRun.divergenceCount} divergencias`
                    : 'Nenhuma conciliacao executada.'}
                </p>
              </div>
              {canReconcile && (
                <button
                  type='button'
                  onClick={() => reconcile(connection.id)}
                  disabled={runningId === connection.id}
                  className='rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-surface-secondary disabled:opacity-60'
                >
                  {runningId === connection.id ? 'Conciliando...' : 'Conciliar agora'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {(failedEvents.length > 0 || divergences.length > 0) && (
        <div className='grid gap-4 border-t border-border bg-surface-secondary/50 px-6 py-5 lg:grid-cols-2'>
          <div>
            <h3 className='text-sm font-semibold text-foreground'>Webhooks com falha</h3>
            <div className='mt-3 space-y-2'>
              {failedEvents.length === 0 ? (
                <p className='text-sm text-muted'>Nenhuma falha pendente.</p>
              ) : failedEvents.map((event) => (
                <div key={event.id} className='rounded-xl border border-border bg-surface px-3 py-3'>
                  <div className='flex items-start justify-between gap-3'>
                    <div>
                      <p className='text-xs font-semibold text-foreground'>{event.eventType}</p>
                      <p className='mt-1 text-xs text-red-700'>{event.errorMessage || 'Falha sem detalhe.'}</p>
                    </div>
                    {canReconcile && (
                      <button
                        type='button'
                        onClick={() => retryWebhook(event.id)}
                        disabled={runningId === event.id}
                        className='text-xs font-semibold text-primary disabled:opacity-60'
                      >
                        Reprocessar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className='text-sm font-semibold text-foreground'>Divergencias pendentes</h3>
            <div className='mt-3 space-y-2'>
              {divergences.length === 0 ? (
                <p className='text-sm text-muted'>Nenhuma divergencia pendente.</p>
              ) : divergences.map((divergence) => (
                <div key={divergence.id} className='rounded-xl border border-border bg-surface px-3 py-3'>
                  <p className='text-xs font-semibold text-foreground'>{divergence.type}</p>
                  <p className='mt-1 text-xs text-amber-700'>{divergence.resolution || 'Aguardando nova conciliacao.'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
