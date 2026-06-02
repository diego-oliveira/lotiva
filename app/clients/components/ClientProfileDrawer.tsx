'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type Membership = {
  id: string
  development: { id: string; name: string }
  roles: { role: { id: string; name: string } }[]
}

type LotSummary = {
  id: string
  identifier: string
  price: number
  status: string
  block: {
    id: string
    identifier: string
    development?: { id: string; name: string } | null
  }
}

type ReservationSummary = {
  id: string
  proposal: string
  status: string
  createdAt: string
  lot: LotSummary
  sale?: { id: string } | null
}

type SaleSummary = {
  id: string
  installmentCount: number
  installmentValue: number
  downPayment: number
  annualAdjustment: boolean
  totalValue: number
  createdAt: string
  lot: LotSummary
  reservation?: { id: string; status: string } | null
  contract?: { id: string; contractNumber: string; emailSent: boolean } | null
}

type ProposalSummary = {
  id: string
  status: string
  salePrice: number
  downPayment: number
  installmentCount: number
  installmentValue: number
  totalValue: number
  interestRate: number
  interestCalculation: string
  correctionIndex: string
  firstDueDate?: string | null
  notes?: string | null
  createdAt: string
  lot: LotSummary
  reservation?: { id: string; status: string } | null
}

type ClientProfile = {
  id: string
  name: string
  email: string
  cpf?: string | null
  rg?: string | null
  address?: string | null
  birthDate?: string | null
  profession?: string | null
  birthplace?: string | null
  maritalStatus?: string | null
  memberships: Membership[]
  reservations: ReservationSummary[]
  proposals: ProposalSummary[]
  sales: SaleSummary[]
  createdAt: string
  updatedAt: string
}

type ClientProfileDrawerProps = {
  clientId: string | null
  isOpen: boolean
  onClose: () => void
  onEdit: (client: ClientProfile) => void
}

const legalFields: { key: keyof ClientProfile; label: string }[] = [
  { key: 'cpf', label: 'CPF' },
  { key: 'rg', label: 'RG' },
  { key: 'birthDate', label: 'Nascimento' },
  { key: 'profession', label: 'Profissao' },
  { key: 'birthplace', label: 'Naturalidade' },
  { key: 'maritalStatus', label: 'Estado civil' },
  { key: 'address', label: 'Endereco' },
]

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

const formatDate = (value?: string | null) => {
  if (!value) return 'Nao informado'
  return new Date(value).toLocaleDateString('pt-BR')
}

function isProfileComplete(client: ClientProfile) {
  return legalFields.every((field) => Boolean(client[field.key]))
}

function getLotLabel(lot: LotSummary) {
  const development = lot.block.development?.name ?? 'Empreendimento'
  return `${development} / Quadra ${lot.block.identifier} / Lote ${lot.identifier}`
}

export default function ClientProfileDrawer({
  clientId,
  isOpen,
  onClose,
  onEdit,
}: ClientProfileDrawerProps) {
  const [client, setClient] = useState<ClientProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchClientProfile() {
      if (!clientId || !isOpen) return

      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/clients/${clientId}`, { cache: 'no-store' })
        if (!response.ok) throw new Error('Nao foi possivel carregar a ficha do cliente')
        setClient(await response.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar ficha')
      } finally {
        setLoading(false)
      }
    }

    void fetchClientProfile()
  }, [clientId, isOpen])

  const summary = useMemo(() => {
    const totalSold = client?.sales.reduce((sum, sale) => sum + sale.totalValue, 0) ?? 0
    const totalReceived = client?.sales.reduce((sum, sale) => sum + sale.downPayment, 0) ?? 0

    return {
      totalSold,
      totalReceived,
      openBalance: totalSold - totalReceived,
    }
  }, [client])

  if (!isOpen) return null

  return (
    <>
      <button
        type='button'
        aria-label='Fechar ficha do cliente'
        className='fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px] lg:left-[290px]'
        onClick={onClose}
      />
      <aside className='fixed inset-y-0 right-0 z-50 w-full max-w-3xl border-l border-border bg-surface shadow-2xl'>
        <div className='flex h-full flex-col'>
          <div className='border-b border-border px-6 py-5'>
            <div className='flex items-start justify-between gap-4'>
              <div>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-muted'>Ficha do cliente</p>
                <h2 className='mt-2 text-2xl font-bold text-foreground'>{client?.name ?? 'Cliente'}</h2>
                <p className='mt-2 text-sm leading-6 text-muted'>{client?.email ?? 'Carregando dados cadastrais e historico comercial.'}</p>
              </div>
              <button
                type='button'
                onClick={onClose}
                className='rounded-xl border border-border bg-surface-secondary p-2 text-muted transition hover:bg-background hover:text-foreground'
              >
                <svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M6 18L18 6M6 6l12 12' />
                </svg>
              </button>
            </div>
          </div>

          <div className='flex-1 overflow-y-auto px-6 py-6'>
            {loading ? (
              <div className='space-y-4'>
                <div className='h-28 animate-pulse rounded-2xl bg-surface-secondary' />
                <div className='h-44 animate-pulse rounded-2xl bg-surface-secondary' />
                <div className='h-44 animate-pulse rounded-2xl bg-surface-secondary' />
              </div>
            ) : error ? (
              <div className='rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>{error}</div>
            ) : client ? (
              <div className='space-y-6'>
                <div className='grid gap-4 md:grid-cols-3'>
                  <div className='rounded-2xl border border-border bg-surface-secondary p-4'>
                    <p className='text-xs font-semibold uppercase text-muted'>Vendido</p>
                    <p className='mt-2 text-xl font-bold text-foreground'>{formatCurrency(summary.totalSold)}</p>
                  </div>
                  <div className='rounded-2xl border border-border bg-surface-secondary p-4'>
                    <p className='text-xs font-semibold uppercase text-muted'>Entrada recebida</p>
                    <p className='mt-2 text-xl font-bold text-foreground'>{formatCurrency(summary.totalReceived)}</p>
                  </div>
                  <div className='rounded-2xl border border-border bg-surface-secondary p-4'>
                    <p className='text-xs font-semibold uppercase text-muted'>Saldo contratado</p>
                    <p className='mt-2 text-xl font-bold text-foreground'>{formatCurrency(summary.openBalance)}</p>
                  </div>
                </div>

                <section className='rounded-2xl border border-border bg-surface-secondary p-5'>
                  <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
                    <div>
                      <h3 className='text-base font-semibold text-foreground'>Dados para contrato</h3>
                      <p className='mt-1 text-sm text-muted'>
                        {isProfileComplete(client) ? 'Cadastro completo para gerar venda e contrato.' : 'Complete os dados legais antes de vender.'}
                      </p>
                    </div>
                    <button
                      type='button'
                      onClick={() => onEdit(client)}
                      className='rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background'
                    >
                      Editar dados
                    </button>
                  </div>
                  <div className='mt-5 grid gap-3 md:grid-cols-2'>
                    {legalFields.map((field) => (
                      <div key={field.key} className='rounded-xl border border-border bg-surface px-4 py-3'>
                        <p className='text-xs font-semibold uppercase text-muted'>{field.label}</p>
                        <p className='mt-1 text-sm font-medium text-foreground'>
                          {field.key === 'birthDate' ? formatDate(client.birthDate) : String(client[field.key] ?? 'Nao informado')}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className='rounded-2xl border border-border bg-surface-secondary p-5'>
                  <div className='flex items-center justify-between gap-3'>
                    <div>
                      <h3 className='text-base font-semibold text-foreground'>Vendas e financeiro</h3>
                      <p className='mt-1 text-sm text-muted'>Contratos, entradas e parcelas da relacao comercial.</p>
                    </div>
                    <Link href={`/sales?userId=${client.id}`} className='rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background'>
                      Vendas do cliente
                    </Link>
                  </div>
                  <div className='mt-4 space-y-3'>
                    {client.sales.length === 0 ? (
                      <div className='rounded-xl border border-dashed border-border bg-surface px-4 py-5 text-center text-sm text-muted'>
                        Nenhuma venda encontrada.
                      </div>
                    ) : (
                      client.sales.map((sale) => (
                        <div key={sale.id} className='rounded-xl border border-border bg-surface px-4 py-3'>
                          <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
                            <div>
                              <p className='text-sm font-semibold text-foreground'>{getLotLabel(sale.lot)}</p>
                              <p className='mt-1 text-xs text-muted'>
                                Entrada {formatCurrency(sale.downPayment)} · {sale.installmentCount}x de {formatCurrency(sale.installmentValue)}
                              </p>
                            </div>
                            <p className='text-sm font-bold text-foreground'>{formatCurrency(sale.totalValue)}</p>
                          </div>
                          <div className='mt-3 flex flex-wrap gap-2 text-xs text-muted'>
                            <span className='rounded-full bg-surface-secondary px-2.5 py-1'>Venda em {formatDate(sale.createdAt)}</span>
                            <span className='rounded-full bg-surface-secondary px-2.5 py-1'>{sale.annualAdjustment ? 'Com reajuste anual' : 'Sem reajuste anual'}</span>
                            {sale.contract && (
                              <span className='rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700'>
                                Contrato {sale.contract.contractNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className='rounded-2xl border border-border bg-surface-secondary p-5'>
                  <div className='flex items-center justify-between gap-3'>
                    <div>
                      <h3 className='text-base font-semibold text-foreground'>Propostas</h3>
                      <p className='mt-1 text-sm text-muted'>Condicoes comerciais simuladas e salvas para este cliente.</p>
                    </div>
                    <span className='pill bg-surface text-muted'>{client.proposals.length}</span>
                  </div>
                  <div className='mt-4 space-y-3'>
                    {client.proposals.length === 0 ? (
                      <div className='rounded-xl border border-dashed border-border bg-surface px-4 py-5 text-center text-sm text-muted'>
                        Nenhuma proposta encontrada.
                      </div>
                    ) : (
                      client.proposals.map((proposal) => (
                        <div key={proposal.id} className='rounded-xl border border-border bg-surface px-4 py-3'>
                          <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
                            <div>
                              <p className='text-sm font-semibold text-foreground'>{getLotLabel(proposal.lot)}</p>
                              <p className='mt-1 text-xs text-muted'>
                                Entrada {formatCurrency(proposal.downPayment)} · {proposal.installmentCount}x de {formatCurrency(proposal.installmentValue)}
                              </p>
                            </div>
                            <p className='text-sm font-bold text-foreground'>{formatCurrency(proposal.totalValue)}</p>
                          </div>
                          <div className='mt-3 flex flex-wrap gap-2 text-xs text-muted'>
                            <span className='rounded-full bg-surface-secondary px-2.5 py-1'>Proposta em {formatDate(proposal.createdAt)}</span>
                            <span className='rounded-full bg-surface-secondary px-2.5 py-1'>{proposal.status}</span>
                            <span className='rounded-full bg-surface-secondary px-2.5 py-1'>
                              {proposal.correctionIndex === 'none' ? 'Sem correcao' : proposal.correctionIndex.toUpperCase()}
                            </span>
                          </div>
                          {proposal.notes && <p className='mt-3 text-xs leading-5 text-muted'>{proposal.notes}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className='rounded-2xl border border-border bg-surface-secondary p-5'>
                  <div className='flex items-center justify-between gap-3'>
                    <div>
                      <h3 className='text-base font-semibold text-foreground'>Empreendimentos</h3>
                      <p className='mt-1 text-sm text-muted'>Acessos e papeis vinculados a este cliente.</p>
                    </div>
                    <Link href={`/lots?userId=${client.id}`} className='rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-strong'>
                      Lotes do cliente
                    </Link>
                  </div>
                  <div className='mt-4 flex flex-wrap gap-2'>
                    {client.memberships.length === 0 ? (
                      <span className='text-sm text-muted'>Sem empreendimento vinculado.</span>
                    ) : (
                      client.memberships.map((membership) => (
                        <span key={membership.id} className='rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary'>
                          {membership.development.name}
                          {membership.roles[0] && <span className='ml-1 text-primary/60'>· {membership.roles[0].role.name}</span>}
                        </span>
                      ))
                    )}
                  </div>
                </section>

                <section className='rounded-2xl border border-border bg-surface-secondary p-5'>
                  <div className='flex items-center justify-between gap-3'>
                    <div>
                      <h3 className='text-base font-semibold text-foreground'>Reservas</h3>
                      <p className='mt-1 text-sm text-muted'>Lotes reservados ou negociacoes em andamento.</p>
                    </div>
                    <span className='pill bg-surface text-muted'>{client.reservations.length}</span>
                  </div>
                  <div className='mt-4 space-y-3'>
                    {client.reservations.length === 0 ? (
                      <div className='rounded-xl border border-dashed border-border bg-surface px-4 py-5 text-center text-sm text-muted'>
                        Nenhuma reserva encontrada.
                      </div>
                    ) : (
                      client.reservations.map((reservation) => (
                        <div key={reservation.id} className='rounded-xl border border-border bg-surface px-4 py-3'>
                          <div className='flex flex-col gap-2 md:flex-row md:items-start md:justify-between'>
                            <div>
                              <p className='text-sm font-semibold text-foreground'>{getLotLabel(reservation.lot)}</p>
                              <p className='mt-1 text-xs text-muted'>{reservation.proposal || 'Sem proposta registrada'}</p>
                            </div>
                            <span className='pill bg-amber-50 text-amber-700'>{reservation.status || 'reservado'}</span>
                          </div>
                          <p className='mt-2 text-xs text-muted'>Criada em {formatDate(reservation.createdAt)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </section>

              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  )
}
