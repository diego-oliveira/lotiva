'use client'

import { useEffect, useState } from 'react'

interface Block {
  id: string
  identifier: string
  createdAt: string
  updatedAt: string
}

interface Lot {
  id: string
  identifier: string
  blockId: string
  front: number
  back: number
  leftSide: number
  rightSide: number
  totalArea: number
  price: number
  status: string
  createdAt: string
  updatedAt: string
  block: Block
}

export default function LotsPage() {
  const [lots, setLots] = useState<Lot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterByBlock, setFilterByBlock] = useState<string>('')
  const [filterByStatus, setFilterByStatus] = useState<string>('')
  const [sortBy, setSortBy] = useState<'identifier' | 'totalArea' | 'price' | 'createdAt'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    fetchLots()
  }, [])

  const fetchLots = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/lots', {
        cache: 'no-store'
      })
      if (!response.ok) {
        throw new Error('Failed to fetch lots')
      }
      const data = await response.json()
      console.log('API Response:', data)
      setLots(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatArea = (value: number) => {
    return `${value.toFixed(2)} m²`
  }

  const formatMeasurement = (value: number) => {
    return `${value.toFixed(2)}m`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const getStatusDisplayName = (status: string) => {
    const statusMap: Record<string, string> = {
      'available': 'Disponível',
      'reserved': 'Reservado',
      'on_hold': 'Reservado',
      'sold': 'Vendido'
    }
    return statusMap[status] || status
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      'available': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      'reserved': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      'on_hold': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      'sold': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    }
    
    const styleClass = styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styleClass}`}>
        {getStatusDisplayName(status)}
      </span>
    )
  }

  const getUniqueBlocks = () => {
    const uniqueBlocks = lots.reduce((acc, lot) => {
      if (!acc.find(block => block.id === lot.block.id)) {
        acc.push(lot.block)
      }
      return acc
    }, [] as Block[])
    return uniqueBlocks.sort((a, b) => a.identifier.localeCompare(b.identifier))
  }

  const getUniqueStatuses = () => {
    console.log('Lots data:', lots)
    const allStatuses = lots.map(lot => lot.status)
    console.log('All statuses:', allStatuses)
    const filteredStatuses = allStatuses.filter(status => status !== null && status !== undefined && status !== '')
    console.log('Filtered statuses:', filteredStatuses)
    const uniqueStatuses = [...new Set(filteredStatuses)]
    console.log('Unique statuses:', uniqueStatuses)
    
    // If no statuses found, provide default options
    if (uniqueStatuses.length === 0) {
      return ['available', 'reserved', 'on_hold', 'sold']
    }
    
    return uniqueStatuses.sort()
  }

  const filteredAndSortedLots = lots
    .filter(lot => !filterByBlock || lot.blockId === filterByBlock)
    .filter(lot => !filterByStatus || lot.status === filterByStatus)
    .sort((a, b) => {
      let aValue: any = a[sortBy]
      let bValue: any = b[sortBy]
      
      if (sortBy === 'identifier') {
        aValue = a.identifier
        bValue = b.identifier
      } else if (sortBy === 'totalArea' || sortBy === 'price') {
        aValue = a[sortBy]
        bValue = b[sortBy]
      } else if (sortBy === 'createdAt') {
        aValue = new Date(a.createdAt).getTime()
        bValue = new Date(b.createdAt).getTime()
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const getSortIcon = (field: typeof sortBy) => {
    if (sortBy !== field) {
      return (
        <svg className="w-4 h-4 ml-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }
    
    if (sortOrder === 'asc') {
      return (
        <svg className="w-4 h-4 ml-1 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
        </svg>
      )
    } else {
      return (
        <svg className="w-4 h-4 ml-1 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      )
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Erro ao carregar lotes
                </h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={fetchLots}
                    className="bg-red-100 dark:bg-red-800 hover:bg-red-200 dark:hover:bg-red-700 text-red-800 dark:text-red-200 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Tentar novamente
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Lotes
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Lista de todos os lotes disponíveis no sistema
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-3 sm:space-y-0">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Total de lotes: {filteredAndSortedLots.length}
                {(filterByBlock || filterByStatus) && ` (filtrado)`}
              </h2>
              
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <select
                  value={filterByBlock}
                  onChange={(e) => setFilterByBlock(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Todos os blocos</option>
                  {getUniqueBlocks().map(block => (
                    <option key={block.id} value={block.id}>
                      Bloco {block.identifier}
                    </option>
                  ))}
                </select>
                
                <select
                  value={filterByStatus}
                  onChange={(e) => setFilterByStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option key="all-status" value="">Todos os status</option>
                  {getUniqueStatuses().map((status, index) => (
                    <option key={`status-${status}-${index}`} value={status}>
                      {getStatusDisplayName(status)}
                    </option>
                  ))}
                </select>
                
                <button
                  onClick={fetchLots}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
                >
                  <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Atualizar
                </button>
              </div>
            </div>

            {filteredAndSortedLots.length === 0 ? (
              <div className="text-center py-8">
                <div className="mx-auto h-12 w-12 text-gray-400">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                  Nenhum lote encontrado
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {(filterByBlock || filterByStatus) ? 'Nenhum lote encontrado para os filtros selecionados.' : 'Comece adicionando um novo lote ao sistema.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                        onClick={() => handleSort('identifier')}
                      >
                        <div className="flex items-center">
                          Lote
                          {getSortIcon('identifier')}
                        </div>
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Bloco
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Dimensões
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                        onClick={() => handleSort('totalArea')}
                      >
                        <div className="flex items-center">
                          Área Total
                          {getSortIcon('totalArea')}
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                        onClick={() => handleSort('price')}
                      >
                        <div className="flex items-center">
                          Preço
                          {getSortIcon('price')}
                        </div>
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                        onClick={() => handleSort('createdAt')}
                      >
                        <div className="flex items-center">
                          Cadastrado em
                          {getSortIcon('createdAt')}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredAndSortedLots.map((lot) => (
                      <tr key={lot.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0">
                              <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center">
                                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                Lote {lot.identifier}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                ID: {lot.id.slice(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            Bloco {lot.block.identifier}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              <span>Frente: {formatMeasurement(lot.front)}</span>
                              <span>Fundo: {formatMeasurement(lot.back)}</span>
                              <span>Esq.: {formatMeasurement(lot.leftSide)}</span>
                              <span>Dir.: {formatMeasurement(lot.rightSide)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatArea(lot.totalArea)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatCurrency(lot.price)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatCurrency(lot.price / lot.totalArea)}/m²
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(lot.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(lot.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}