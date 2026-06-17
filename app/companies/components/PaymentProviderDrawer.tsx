'use client'

import { useEffect, useState } from 'react'
import FormDrawer from '@/app/components/FormDrawer'

interface Company {
  id: string
  name: string
}

interface PaymentProviderConnection {
  id: string
  provider: string
  environment: 'sandbox' | 'production'
  status: string
  credentialHint: string | null
  lastValidatedAt: string | null
  webhookUrl: string | null
  webhookStatus: string | null
  webhookAuthHint: string | null
  lastWebhookAt: string | null
}

interface PaymentProviderDrawerProps {
  company: Company | null
  isOpen: boolean
  onClose: () => void
}

function environmentLabel(environment: 'sandbox' | 'production') {
  return environment === 'production' ? 'Conta real' : 'Conta de teste'
}

export default function PaymentProviderDrawer({
  company,
  isOpen,
  onClose,
}: PaymentProviderDrawerProps) {
  const [connections, setConnections] = useState<PaymentProviderConnection[]>([])
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox')
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadConnections = async () => {
    if (!company) return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/companies/${company.id}/payment-provider`, {
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => [])
      if (!response.ok) {
        throw new Error(payload.error || 'Nao foi possivel carregar as conexoes financeiras.')
      }
      setConnections(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel carregar as conexoes financeiras.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen || !company) return
    setEnvironment('sandbox')
    setApiKey('')
    setSuccess(null)
    void loadConnections()
  }, [isOpen, company?.id])

  if (!company) return null

  const connect = async () => {
    if (!apiKey.trim()) {
      setError('Informe a chave da API Asaas.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(`/api/companies/${company.id}/payment-provider`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment, apiKey }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.details || payload.error || 'Nao foi possivel conectar ao Asaas.')
      }

      setApiKey('')
      setSuccess(
        payload.webhookWarning
          ? `Conexao salva. Webhook pendente: ${payload.webhookWarning}`
          : `Conexao ${environmentLabel(environment)} validada e salva.`,
      )
      await loadConnections()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel conectar ao Asaas.')
    } finally {
      setSaving(false)
    }
  }

  const disconnect = async (connectionEnvironment: 'sandbox' | 'production') => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(`/api/companies/${company.id}/payment-provider`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment: connectionEnvironment }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Nao foi possivel desconectar o Asaas.')
      }

      setSuccess(`Conexao ${environmentLabel(connectionEnvironment)} removida.`)
      await loadConnections()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel desconectar o Asaas.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDrawer
      isOpen={isOpen}
      title={`Asaas - ${company.name}`}
      description='Conecte a conta Asaas usada para gerar boletos e acompanhar pagamentos desta empresa.'
      onClose={onClose}
    >
      <div className='space-y-6'>
        {error && (
          <div className='rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700'>
            {error}
          </div>
        )}
        {success && (
          <div className='rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700'>
            {success}
          </div>
        )}

        <section className='rounded-2xl border border-border bg-surface'>
          <div className='border-b border-border bg-surface-secondary px-5 py-4'>
            <h3 className='font-semibold text-foreground'>Conta Asaas</h3>
            <p className='mt-1 text-sm text-muted'>Use a conta de teste durante homologacao e a conta real quando for operar vendas de verdade.</p>
          </div>
          {loading ? (
            <div className='px-5 py-8 text-sm text-muted'>Carregando conexoes...</div>
          ) : (
            <div className='divide-y divide-border'>
              {(['sandbox', 'production'] as const).map((itemEnvironment) => {
                const connection = connections.find(
                  (item) => item.environment === itemEnvironment && item.status === 'active',
                )

                return (
                  <div key={itemEnvironment} className='flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between'>
                    <div>
                      <div className='flex items-center gap-2'>
                        <p className='text-sm font-semibold text-foreground'>{environmentLabel(itemEnvironment)}</p>
                        <span className={`pill ${connection ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {connection ? 'Conectado' : 'Nao configurado'}
                        </span>
                      </div>
                      <p className='mt-1 text-sm text-muted'>
                        {connection
                          ? `Chave ${connection.credentialHint || 'protegida'}${connection.lastValidatedAt ? `, validada em ${new Date(connection.lastValidatedAt).toLocaleString('pt-BR')}` : ''}`
                          : 'Nenhuma credencial ativa para esta conta.'}
                      </p>
                      {connection && (
                        <p className='mt-1 text-xs text-muted'>
                          Webhook: {connection.webhookStatus === 'active'
                            ? 'ativo'
                            : connection.webhookStatus === 'awaiting_public_url'
                              ? 'aguardando URL publica'
                              : connection.webhookStatus || 'nao configurado'}
                          {connection.lastWebhookAt
                            ? ` · ultimo evento em ${new Date(connection.lastWebhookAt).toLocaleString('pt-BR')}`
                            : ''}
                        </p>
                      )}
                    </div>
                    {connection && (
                      <button
                        type='button'
                        disabled={saving}
                        onClick={() => disconnect(itemEnvironment)}
                        className='rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60'
                      >
                        Desconectar
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className='rounded-2xl border border-border bg-surface p-5'>
          <h3 className='font-semibold text-foreground'>Adicionar ou substituir chave</h3>
          <p className='mt-1 text-sm leading-6 text-muted'>
            A chave sera validada no Asaas antes de ser armazenada de forma criptografada.
          </p>

          <label className='mt-5 block'>
            <span className='mb-2 block text-sm font-semibold text-foreground'>Tipo de conta</span>
            <select
              value={environment}
              onChange={(event) => setEnvironment(event.target.value as 'sandbox' | 'production')}
              className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary'
            >
              <option value='sandbox'>Conta de teste</option>
              <option value='production'>Conta real</option>
            </select>
          </label>

          <label className='mt-4 block'>
            <span className='mb-2 block text-sm font-semibold text-foreground'>Chave da API</span>
            <input
              type='password'
              autoComplete='off'
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder='$aact_...'
              className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary'
            />
          </label>

          <div className='mt-5 flex justify-end'>
            <button
              type='button'
              disabled={saving || !apiKey.trim()}
              onClick={connect}
              className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-60'
            >
              {saving ? 'Validando...' : 'Validar e conectar'}
            </button>
          </div>
        </section>

        <div className='rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800'>
          Use a conta de teste para validar o fluxo sem impacto financeiro real. Troque para a conta real apenas quando a empresa estiver pronta para operar.
        </div>
      </div>
    </FormDrawer>
  )
}
