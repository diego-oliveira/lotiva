'use client'

import { useEffect, useState } from 'react'
import SalesForm from './components/SalesForm'
import ContractViewer from './components/ContractViewer'
import ReceivablesDrawer from './components/ReceivablesDrawer'

interface Block {
  id: string
  identifier: string
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

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)
  const [initialSaleData, setInitialSaleData] = useState<{ userId?: string; lotId?: string; reservationId?: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showContract, setShowContract] = useState(false)
  const [contractSaleId, setContractSaleId] = useState<string>('')
  const [receivablesSale, setReceivablesSale] = useState<Sale | null>(null)

  useEffect(() => {
    fetchSales()

    const params = new URLSearchParams(window.location.search)
    const lotId = params.get('lotId')
    if (lotId) {
      setEditingSale(null)
      setInitialSaleData({
        lotId,
        userId: params.get('userId') ?? undefined,
        reservationId: params.get('reservationId') ?? undefined,
      })
      setShowForm(true)
    }
  }, [])

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

  const handleEditSale = (sale: Sale) => {
    setEditingSale(sale)
    setInitialSaleData(null)
    setNotice(null)
    setShowForm(true)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingSale(null)
    setInitialSaleData(null)
  }

  const handleFormSave = async () => {
    const message = editingSale ? 'Venda atualizada com sucesso.' : 'Venda criada com sucesso. O lote foi marcado como vendido e o contrato foi gerado.'
    await fetchSales()
    setShowForm(false)
    setEditingSale(null)
    setInitialSaleData(null)
    setNotice(message)
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

  const totals = sales.reduce(
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
          <button onClick={fetchSales} className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'>
            Atualizar
          </button>
          <button onClick={handleAddSale} className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong'>
            Nova venda
          </button>
        </div>
      </div>

      {notice && (
        <div className='rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800'>
          {notice}
        </div>
      )}

      <section className='grid gap-4 md:grid-cols-4'>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Vendas</p>
          <p className='metric-value'>{sales.length}</p>
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
            {searchTerm ? `${filteredSales.length} de ${sales.length} vendas` : `Total de vendas: ${sales.length}`}
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
              {searchTerm ? 'Nenhuma venda encontrada' : 'Nenhuma venda realizada'}
            </h3>
            <p className='mt-2 text-sm text-muted'>
              {searchTerm ? <>Nenhuma venda corresponde a "<span className='font-medium'>{searchTerm}</span>".</> : 'Converta um lote disponivel ou reservado em venda para gerar contrato e parcelas.'}
            </p>
            {searchTerm ? (
              <button onClick={() => setSearchTerm('')} className='mt-6 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'>
                Limpar busca
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
                      <div className='text-sm text-muted'>{sale.lot.totalArea.toFixed(2)} m2</div>
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
                        <button onClick={() => handleEditSale(sale)} className='rounded-xl px-3 py-2 text-primary transition hover:bg-primary/8'>
                          Editar
                        </button>
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
        onClose={handleFormClose}
        onSave={handleFormSave}
      />

      <ContractViewer
        saleId={contractSaleId}
        isOpen={showContract}
        onClose={handleCloseContract}
      />

      <ReceivablesDrawer
        sale={receivablesSale}
        isOpen={Boolean(receivablesSale)}
        onClose={() => setReceivablesSale(null)}
        onUpdated={handleReceivablesUpdated}
      />
    </div>
  )
}
