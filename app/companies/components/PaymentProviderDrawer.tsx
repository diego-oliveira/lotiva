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

function providerLabel(provider: 'asaas' | 'inter') {
  return provider === 'inter' ? 'Banco Inter' : 'Asaas'
}

export default function PaymentProviderDrawer({
  company,
  isOpen,
  onClose,
}: PaymentProviderDrawerProps) {
  const [connections, setConnections] = useState<PaymentProviderConnection[]>([])
  const [provider, setProvider] = useState<'asaas' | 'inter'>('asaas')
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox')
  const [apiKey, setApiKey] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [certificate, setCertificate] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
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
    setProvider('asaas')
    setApiKey('')
    setClientId('')
    setClientSecret('')
    setCertificate('')
    setPrivateKey('')
    setAccountNumber('')
    setSuccess(null)
    void loadConnections()
  }, [isOpen, company?.id])

  if (!company) return null

  const connect = async () => {
    if (provider === 'asaas' && !apiKey.trim()) {
      setError('Informe a chave da API Asaas.')
      return
    }
    if (provider === 'inter' && (!clientId.trim() || !clientSecret.trim() || !certificate.trim() || !privateKey.trim())) {
      setError('Informe Client ID, Client Secret, certificado e chave privada do Inter.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(`/api/companies/${company.id}/payment-provider`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          environment,
          apiKey,
          clientId,
          clientSecret,
          certificate,
          privateKey,
          accountNumber,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.details || payload.error || 'Nao foi possivel conectar ao provedor.')
      }

      setApiKey('')
      setClientId('')
      setClientSecret('')
      setCertificate('')
      setPrivateKey('')
      setAccountNumber('')
      setSuccess(
        payload.webhookWarning
          ? `Conexao salva. Webhook pendente: ${payload.webhookWarning}`
          : `Conexao ${providerLabel(provider)} ${environmentLabel(environment)} validada e salva.`,
      )
      await loadConnections()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel conectar ao provedor.')
    } finally {
      setSaving(false)
    }
  }

  const disconnect = async (connectionProvider: 'asaas' | 'inter', connectionEnvironment: 'sandbox' | 'production') => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(`/api/companies/${company.id}/payment-provider`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: connectionProvider, environment: connectionEnvironment }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Nao foi possivel desconectar o provedor.')
      }

      setSuccess(`Conexao ${providerLabel(connectionProvider)} ${environmentLabel(connectionEnvironment)} removida.`)
      await loadConnections()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel desconectar o provedor.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDrawer
      isOpen={isOpen}
      title={`Pagamentos - ${company.name}`}
      description='Conecte os provedores usados para gerar boletos e acompanhar pagamentos desta empresa.'
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
            <h3 className='font-semibold text-foreground'>Contas conectadas</h3>
            <p className='mt-1 text-sm text-muted'>Use a conta de teste durante homologacao e a conta real quando for operar vendas de verdade.</p>
          </div>
          {loading ? (
            <div className='px-5 py-8 text-sm text-muted'>Carregando conexoes...</div>
          ) : (
            <div className='divide-y divide-border'>
              {(['asaas', 'inter'] as const).flatMap((itemProvider) => (['sandbox', 'production'] as const).map((itemEnvironment) => {
                const connection = connections.find(
                  (item) => item.provider === itemProvider && item.environment === itemEnvironment && item.status === 'active',
                )

                return (
                  <div key={`${itemProvider}-${itemEnvironment}`} className='flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between'>
                    <div>
                      <div className='flex items-center gap-2'>
                        <p className='text-sm font-semibold text-foreground'>{providerLabel(itemProvider)} - {environmentLabel(itemEnvironment)}</p>
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
                        onClick={() => disconnect(itemProvider, itemEnvironment)}
                        className='rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60'
                      >
                        Desconectar
                      </button>
                    )}
                  </div>
                )
              }))}
            </div>
          )}
        </section>

        <section className='rounded-2xl border border-border bg-surface p-5'>
          <h3 className='font-semibold text-foreground'>Adicionar ou substituir conexao</h3>
          <p className='mt-1 text-sm leading-6 text-muted'>
            As credenciais serao validadas antes de serem armazenadas de forma criptografada.
          </p>

          <label className='mt-5 block'>
            <span className='mb-2 block text-sm font-semibold text-foreground'>Provedor</span>
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value as 'asaas' | 'inter')}
              className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary'
            >
              <option value='asaas'>Asaas</option>
              <option value='inter'>Banco Inter</option>
            </select>
          </label>

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

          {provider === 'asaas' ? (
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
          ) : (
            <div className='mt-4 space-y-4'>
              <label className='block'>
                <span className='mb-2 block text-sm font-semibold text-foreground'>Client ID</span>
                <input
                  type='text'
                  autoComplete='off'
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary'
                />
              </label>
              <label className='block'>
                <span className='mb-2 block text-sm font-semibold text-foreground'>Client Secret</span>
                <input
                  type='password'
                  autoComplete='off'
                  value={clientSecret}
                  onChange={(event) => setClientSecret(event.target.value)}
                  className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary'
                />
              </label>
              <label className='block'>
                <span className='mb-2 block text-sm font-semibold text-foreground'>Conta corrente</span>
                <input
                  type='text'
                  autoComplete='off'
                  value={accountNumber}
                  onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, ''))}
                  placeholder='Opcional'
                  className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary'
                />
              </label>
              <label className='block'>
                <span className='mb-2 block text-sm font-semibold text-foreground'>Certificado .crt</span>
                <textarea
                  value={certificate}
                  onChange={(event) => setCertificate(event.target.value)}
                  rows={5}
                  className='w-full rounded-xl border border-border bg-background px-4 py-3 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-primary'
                />
              </label>
              <label className='block'>
                <span className='mb-2 block text-sm font-semibold text-foreground'>Chave privada .key</span>
                <textarea
                  value={privateKey}
                  onChange={(event) => setPrivateKey(event.target.value)}
                  rows={5}
                  className='w-full rounded-xl border border-border bg-background px-4 py-3 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-primary'
                />
              </label>
            </div>
          )}

          <div className='mt-5 flex justify-end'>
            <button
              type='button'
              disabled={saving || (provider === 'asaas' ? !apiKey.trim() : (!clientId.trim() || !clientSecret.trim() || !certificate.trim() || !privateKey.trim()))}
              onClick={connect}
              className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-60'
            >
              {saving ? 'Validando...' : 'Validar e conectar'}
            </button>
          </div>
        </section>

        <div className='rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800'>
          Use a conta de teste para validar o fluxo sem impacto financeiro real. No Inter, baixe e guarde o certificado e as credenciais assim que a integracao for criada no Internet Banking PJ.
        </div>
      </div>
    </FormDrawer>
  )
}
