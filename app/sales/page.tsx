'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'
import SalesForm from './components/SalesForm'
import ContractViewer from './components/ContractViewer'
import ReceivablesDrawer from './components/ReceivablesDrawer'
import LegacySalesImportDrawer from './components/LegacySalesImportDrawer'

interface Block {
  id: string
  identifier: string
  development?: Development | null
}

interface Development {
  id: string
  name: string
}

interface Lot {
  id: string
  identifier: string
  totalArea: number
  price: number
  block: Block
}

interface User {
  id: string
  name: string
  email: string
  cpf?: string | null
}

interface Reservation {
  id: string
  proposal: string
  status: string
}

interface Receivable {
  id: string
  kind: string
  sequence: number
  dueDate: string
  amount: number
  paidAmount: number
  balance: number
  status: string
  paidAt?: string | null
}

interface Sale {
  id: string
  userId: string
  lotId: string
  reservationId?: string
  installmentCount: number
  installmentValue: number
  downPayment: number
  firstDueDate?: string | null
  annualAdjustment: boolean
  totalValue: number
  createdAt: string
  updatedAt: string
  user: User
  lot: Lot
  reservation?: Reservation
  receivables?: Receivable[]
  contract?: { id: string; contractNumber: string } | null
  canManagePayments?: boolean
  canCancelPayments?: boolean
  canApproveAdjustments?: boolean
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('pt-BR')
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function SalesContent() {
  const searchParams = useSearchParams()
  const developmentFilter = searchParams.get('developmentId') ?? ''
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)
  const [correctionSale, setCorrectionSale] = useState<Sale | null>(null)
  const [correctionReason, setCorrectionReason] = useState('')
  const [initialSaleData, setInitialSaleData] = useState<{ userId?: string; lotId?: string; reservationId?: string; proposalId?: string } | null>(null)
  const [notice, setNotice] = useState<{ message: string; developmentId?: string } | null>(null)
  const [showContract, setShowContract] = useState(false)
  const [contractSaleId, setContractSaleId] = useState<string>('')
  const [receivablesSale, setReceivablesSale] = useState<Sale | null>(null)
  const [canCorrectSales, setCanCorrectSales] = useState(false)
  const [showLegacyImport, setShowLegacyImport] = useState(false)

  useEffect(() => {
    fetchSales()
    fetch('/api/me/permissions', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        setCanCorrectSales(Boolean(payload?.permissions?.admin))
      })
      .catch(() => {
        setCanCorrectSales(false)
      })

    const params = new URLSearchParams(window.location.search)
    const lotId = params.get('lotId')
    if (lotId) {
      setEditingSale(null)
      setInitialSaleData({
        lotId,
        userId: params.get('userId') ?? undefined,
        reservationId: params.get('reservationId') ?? undefined,
        proposalId: params.get('proposalId') ?? undefined,
      })
      setShowForm(true)
    }
  }, [])

  useEffect(() => {
    const userId = searchParams.get('userId')
    setClientFilter(userId ?? '')
  }, [searchParams])

  useEffect(() => {
    setNotice((current) => {
      if (!current || !developmentFilter) return current
      if (!current.developmentId) return null
      if (current.developmentId === developmentFilter) return current
      return null
    })
  }, [developmentFilter])

  const fetchSales = async () => {
    try {
      setLoading(true)
      setNotice(null)
      const response = await fetch('/api/sales', { cache: 'no-store' })
      if (!response.ok) throw new Error('Nao foi possivel carregar as vendas')
      const nextSales = (await response.json()) as Sale[]
      setSales(nextSales)
      setError(null)
      return nextSales
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar vendas')
      return null
    } finally {
      setLoading(false)
    }
  }

  const handleAddSale = () => {
    setEditingSale(null)
    setInitialSaleData(null)
    setNotice(null)
    setShowForm(true)
  }

  const saleHasPaidReceivable = (sale: Sale) => Boolean(sale.receivables?.some((receivable) => receivable.status === 'paid' || receivable.paidAmount > 0))
  const saleIsLocked = (sale: Sale) => Boolean(sale.contract || saleHasPaidReceivable(sale))

  const handleEditSale = (sale: Sale) => {
    if (saleIsLocked(sale)) return
    setCorrectionSale(sale)
    setCorrectionReason('')
  }

  const confirmSaleCorrection = () => {
    if (!correctionSale || !correctionReason.trim()) return
    setEditingSale(correctionSale)
    setInitialSaleData(null)
    setNotice(null)
    setCorrectionSale(null)
    setShowForm(true)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingSale(null)
    setInitialSaleData(null)
    setCorrectionReason('')
  }

  const handleFormSave = async () => {
    const message = editingSale ? 'Venda atualizada com sucesso.' : 'Venda criada com sucesso. O lote foi marcado como vendido e o contrato foi gerado.'
    const noticeDevelopmentId = editingSale?.lot.block.development?.id ?? developmentFilter
    const nextSales = await fetchSales()
    const savedSale = initialSaleData?.lotId
      ? nextSales?.find((sale) => sale.lotId === initialSaleData.lotId)
      : null
    setShowForm(false)
    setEditingSale(null)
    setInitialSaleData(null)
    setCorrectionReason('')
    setNotice({
      message,
      developmentId: savedSale?.lot.block.development?.id ?? noticeDevelopmentId,
    })
  }

  const handleLegacyImport = async (count: number) => {
    await fetchSales()
    setNotice({
      message: `${count} venda(s) legada(s) importada(s) com sucesso.`,
      developmentId: developmentFilter,
    })
  }

  const handleViewContract = (saleId: string) => {
    setContractSaleId(saleId)
    setShowContract(true)
  }

  const handleCloseContract = () => {
    setShowContract(false)
    setContractSaleId('')
  }

  const handleViewReceivables = (sale: Sale) => {
    setReceivablesSale(sale)
  }

  const handleReceivablesUpdated = async () => {
    const nextSales = await fetchSales()
    if (!nextSales) return
    setReceivablesSale((current) => {
      if (!current) return null
      return nextSales.find((sale) => sale.id === current.id) ?? current
    })
  }

  const filteredSales = sales.filter((sale) => {
    if (developmentFilter && sale.lot.block.development?.id !== developmentFilter) return false
    if (clientFilter && sale.userId !== clientFilter) return false
    if (!searchTerm) return true

    const searchLower = searchTerm.toLowerCase()
    const digits = searchTerm.replace(/\D/g, '')
    return (
      sale.user.name.toLowerCase().includes(searchLower) ||
      sale.user.email.toLowerCase().includes(searchLower) ||
      Boolean(digits && sale.user.cpf?.replace(/\D/g, '').includes(digits)) ||
      `${sale.lot.block.identifier}${sale.lot.identifier}`.toLowerCase().includes(searchLower)
    )
  })

  const totals = filteredSales.reduce(
    (acc, sale) => ({
      totalValue: acc.totalValue + sale.totalValue,
      downPayment: acc.downPayment + sale.downPayment,
      openBalance: acc.openBalance + sale.totalValue - sale.downPayment,
    }),
    { totalValue: 0, downPayment: 0, openBalance: 0 },
  )

  if (loading) {
    return (
      <div className='space-y-6'>
        <div className='h-20 animate-pulse rounded-2xl bg-surface-secondary' />
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
        <p className='font-semibold'>Erro ao carregar vendas</p>
        <p className='mt-1 text-sm'>{error}</p>
        <button onClick={fetchSales} className='mt-4 rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-800 transition hover:bg-red-200'>
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='page-title'>Vendas</h1>
          <p className='page-subtitle'>Conclua vendas, acompanhe contratos e revise as condicoes comerciais fechadas.</p>
        </div>
        <div className='flex flex-wrap gap-3'>
          <button
            onClick={() => setShowLegacyImport(true)}
            disabled={!developmentFilter}
            title={!developmentFilter ? 'Selecione um empreendimento para importar vendas legadas' : 'Importar vendas legadas'}
            className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-60'
          >
            Importar vendas
          </button>
          <button onClick={handleAddSale} className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong'>
            Nova venda
          </button>
        </div>
      </div>

      {notice && (
        <div className='rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800'>
          {notice.message}
        </div>
      )}

      <section className='grid gap-4 md:grid-cols-4'>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Vendas</p>
          <p className='metric-value'>{filteredSales.length}</p>
        </div>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Valor contratado</p>
          <p className='metric-value'>{formatCurrency(totals.totalValue)}</p>
        </div>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Entradas</p>
          <p className='metric-value text-emerald-700'>{formatCurrency(totals.downPayment)}</p>
        </div>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Saldo contratado</p>
          <p className='metric-value'>{formatCurrency(totals.openBalance)}</p>
        </div>
      </section>

      <div className='panel overflow-hidden'>
        <div className='panel-header flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between'>
          <h2 className='text-lg font-semibold text-foreground'>
            {(searchTerm || clientFilter)
              ? `${filteredSales.length} venda(s) encontrada(s)`
              : `Total de vendas: ${filteredSales.length}`}
          </h2>
          <div className='relative w-full md:max-w-xs'>
            <input
              type='text'
              placeholder='Buscar por cliente, CPF ou lote...'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className='block w-full rounded-2xl border border-border bg-background px-4 py-3 pr-10 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className='absolute inset-y-0 right-3 my-auto h-5 text-muted transition hover:text-foreground'
                title='Limpar busca'
              >
                <svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M6 18L18 6M6 6l12 12' />
                </svg>
              </button>
            )}
          </div>
        </div>

        {filteredSales.length === 0 ? (
          <div className='px-6 py-12 text-center'>
            <div className='mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-secondary text-muted'>
              <svg className='h-7 w-7' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-4 7h4m-4 4h4' />
              </svg>
            </div>
            <h3 className='mt-4 text-base font-semibold text-foreground'>
              {(searchTerm || clientFilter) ? 'Nenhuma venda encontrada' : 'Nenhuma venda realizada'}
            </h3>
            <p className='mt-2 text-sm text-muted'>
              {(searchTerm || clientFilter) ? <>Nenhuma venda corresponde aos filtros atuais.</> : 'Converta um lote disponivel ou reservado em venda para gerar contrato e parcelas.'}
            </p>
            {(searchTerm || clientFilter) ? (
              <button onClick={() => { setSearchTerm(''); setClientFilter('') }} className='mt-6 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'>
                Limpar filtros
              </button>
            ) : (
              <button onClick={handleAddSale} className='mt-6 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong'>
                Primeira venda
              </button>
            )}
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='min-w-full divide-y divide-border'>
              <thead className='bg-surface-secondary'>
                <tr>
                  <th className='table-head px-6 py-4 text-left'>Cliente</th>
                  <th className='table-head px-6 py-4 text-left'>Lote</th>
                  <th className='table-head px-6 py-4 text-left'>Valor total</th>
                  <th className='table-head px-6 py-4 text-left'>Entrada</th>
                  <th className='table-head px-6 py-4 text-left'>Parcelas</th>
                  <th className='table-head px-6 py-4 text-left'>Data</th>
                  <th className='table-head px-6 py-4 text-right'>Acoes</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border bg-surface'>
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className='transition hover:bg-surface-secondary/70'>
                    <td className='whitespace-nowrap px-6 py-4'>
                      <div className='flex items-center gap-4'>
                        <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white'>
                          {getInitials(sale.user.name)}
                        </div>
                        <div>
                          <div className='text-sm font-semibold text-foreground'>{sale.user.name}</div>
                          <div className='text-sm text-muted'>{sale.user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className='whitespace-nowrap px-6 py-4'>
                      <div className='text-sm font-semibold text-foreground'>Quadra {sale.lot.block.identifier}, Lote {sale.lot.identifier}</div>
                      <div className='text-sm text-muted'>{sale.lot.block.development?.name ?? 'Sem empreendimento'} · {sale.lot.totalArea.toFixed(2)} m2</div>
                    </td>
                    <td className='whitespace-nowrap px-6 py-4 text-sm font-semibold text-foreground'>{formatCurrency(sale.totalValue)}</td>
                    <td className='whitespace-nowrap px-6 py-4 text-sm text-foreground'>{formatCurrency(sale.downPayment)}</td>
                    <td className='whitespace-nowrap px-6 py-4'>
                      <div className='text-sm text-foreground'>{sale.installmentCount}x {formatCurrency(sale.installmentValue)}</div>
                      {sale.annualAdjustment && <div className='mt-1 text-xs text-muted'>Com reajuste anual</div>}
                    </td>
                    <td className='whitespace-nowrap px-6 py-4 text-sm text-muted'>{formatDate(sale.createdAt)}</td>
                    <td className='whitespace-nowrap px-6 py-4 text-right text-sm font-semibold'>
                      <div className='flex items-center justify-end gap-2'>
                        <button onClick={() => handleViewContract(sale.id)} className='rounded-xl px-3 py-2 text-primary transition hover:bg-primary/8'>
                          Contrato
                        </button>
                        <button onClick={() => handleViewReceivables(sale)} className='rounded-xl px-3 py-2 text-primary transition hover:bg-primary/8'>
                          Parcelas
                        </button>
                        {canCorrectSales && (
                          <button
                            onClick={() => handleEditSale(sale)}
                            disabled={saleIsLocked(sale)}
                            title={saleIsLocked(sale) ? 'Venda com contrato ou parcela paga nao pode ser corrigida diretamente' : 'Corrigir venda'}
                            className='rounded-xl px-3 py-2 text-primary transition hover:bg-primary/8 disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent'
                          >
                            Corrigir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SalesForm
        sale={editingSale}
        initialData={initialSaleData}
        isOpen={showForm}
        developmentId={developmentFilter}
        onClose={handleFormClose}
        onSave={handleFormSave}
        correctionReason={correctionReason}
      />

      <LegacySalesImportDrawer
        developmentId={developmentFilter}
        isOpen={showLegacyImport}
        onClose={() => setShowLegacyImport(false)}
        onImported={handleLegacyImport}
      />

      {correctionSale && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4'>
          <div className='w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl'>
            <h2 className='text-lg font-semibold text-foreground'>Corrigir venda</h2>
            <p className='mt-2 text-sm leading-6 text-muted'>
              Informe o motivo da correcao antes de alterar esta venda. A justificativa sera registrada no historico do lote.
            </p>
            <div className='mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'>
              Revise com cuidado: alteracoes em vendas podem afetar contrato, parcelas e financeiro.
            </div>
            <label className='mt-5 block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Motivo da correcao</span>
              <textarea
                rows={4}
                value={correctionReason}
                onChange={(event) => setCorrectionReason(event.target.value)}
                className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                placeholder='Ex.: ajuste de data de vencimento solicitado pelo cliente'
              />
            </label>
            <div className='mt-6 flex justify-end gap-3'>
              <button
                type='button'
                onClick={() => { setCorrectionSale(null); setCorrectionReason('') }}
                className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'
              >
                Cancelar
              </button>
              <button
                type='button'
                onClick={confirmSaleCorrection}
                disabled={!correctionReason.trim()}
                className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-60'
              >
                Continuar correcao
              </button>
            </div>
          </div>
        </div>
      )}

      <ContractViewer
        saleId={contractSaleId}
        isOpen={showContract}
        onClose={handleCloseContract}
      />

      <ReceivablesDrawer
        sale={receivablesSale}
        isOpen={Boolean(receivablesSale)}
        canManagePayments={Boolean(receivablesSale?.canManagePayments)}
        canCancelPayments={Boolean(receivablesSale?.canCancelPayments)}
        canApproveAdjustments={Boolean(receivablesSale?.canApproveAdjustments)}
        onClose={() => setReceivablesSale(null)}
        onUpdated={handleReceivablesUpdated}
      />
    </div>
  )
}

export default function SalesPage() {
  return (
    <Suspense fallback={<div className='h-24 animate-pulse rounded-2xl bg-surface-secondary' />}>
      <SalesContent />
    </Suspense>
  )
}
