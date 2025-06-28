'use client'

import { useState, useEffect } from 'react'

interface Block {
  id: string
  identifier: string
}

interface Lot {
  id: string
  identifier: string
  totalArea: number
  price: number
  status: string
  block: Block
}

interface Customer {
  id: string
  name: string
  email: string
  cpf: string
}

interface SaleFormData {
  customerId: string
  lotId: string
  reservationId?: string
  installmentCount: number
  installmentValue: number
  downPayment: number
  annualAdjustment: boolean
  totalValue: number
}

interface SalesFormProps {
  sale?: any | null
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

const STEPS = [
  { id: 1, name: 'Cliente', description: 'Selecionar cliente' },
  { id: 2, name: 'Lote', description: 'Escolher lote disponível' },
  { id: 3, name: 'Pagamento', description: 'Configurar termos de pagamento' },
  { id: 4, name: 'Revisão', description: 'Confirmar detalhes da venda' },
]

export default function SalesForm({ sale, isOpen, onClose, onSave }: SalesFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [lotSearch, setLotSearch] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState<SaleFormData>({
    customerId: '',
    lotId: '',
    reservationId: '',
    installmentCount: 1,
    installmentValue: 0,
    downPayment: 0,
    annualAdjustment: true,
    totalValue: 0,
  })

  useEffect(() => {
    if (isOpen) {
      fetchCustomers()
      fetchAvailableLots()
      if (sale) {
        setFormData({
          customerId: sale.customerId,
          lotId: sale.lotId,
          reservationId: sale.reservationId || '',
          installmentCount: sale.installmentCount,
          installmentValue: sale.installmentValue,
          downPayment: sale.downPayment,
          annualAdjustment: sale.annualAdjustment,
          totalValue: sale.totalValue,
        })
      } else {
        setFormData({
          customerId: '',
          lotId: '',
          reservationId: '',
          installmentCount: 1,
          installmentValue: 0,
          downPayment: 0,
          annualAdjustment: true,
          totalValue: 0,
        })
      }
      setCurrentStep(1)
      setErrors({})
    }
  }, [isOpen, sale])

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/clients')
      if (response.ok) {
        const data = await response.json()
        setCustomers(data)
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    }
  }

  const fetchAvailableLots = async () => {
    try {
      const response = await fetch('/api/lots')
      if (response.ok) {
        const data = await response.json()
        // Filter only available lots (unless editing existing sale)
        const availableLots = sale ? data : data.filter((lot: Lot) => lot.status === 'available')
        setLots(availableLots)
      }
    } catch (error) {
      console.error('Error fetching lots:', error)
    }
  }

  const selectedCustomer = customers.find(c => c.id === formData.customerId)
  const selectedLot = lots.find(l => l.id === formData.lotId)

  const filteredCustomers = customers.filter(customer => {
    if (!customerSearch) return true
    const searchLower = customerSearch.toLowerCase()
    return (
      customer.name.toLowerCase().includes(searchLower) ||
      customer.email.toLowerCase().includes(searchLower) ||
      customer.cpf.replace(/\D/g, '').includes(customerSearch.replace(/\D/g, ''))
    )
  })

  const filteredLots = lots.filter(lot => {
    if (!lotSearch) return true
    const searchLower = lotSearch.toLowerCase()
    return (
      lot.identifier.toLowerCase().includes(searchLower) ||
      lot.block.identifier.toLowerCase().includes(searchLower) ||
      `${lot.block.identifier}${lot.identifier}`.toLowerCase().includes(searchLower)
    )
  })

  // Auto-calculate values when lot or payment terms change
  useEffect(() => {
    if (selectedLot && formData.installmentCount > 0) {
      const lotPrice = selectedLot.price
      const remainingValue = lotPrice - formData.downPayment
      const installmentValue = remainingValue / formData.installmentCount
      
      setFormData(prev => ({
        ...prev,
        totalValue: lotPrice,
        installmentValue: Math.max(0, installmentValue)
      }))
    }
  }, [selectedLot, formData.downPayment, formData.installmentCount])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const handleInputChange = (field: keyof SaleFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateStep = (step: number) => {
    const newErrors: Record<string, string> = {}

    switch (step) {
      case 1:
        if (!formData.customerId) newErrors.customerId = 'Selecione um cliente'
        break
      case 2:
        if (!formData.lotId) newErrors.lotId = 'Selecione um lote'
        break
      case 3:
        if (formData.installmentCount < 1) newErrors.installmentCount = 'Mínimo 1 parcela'
        if (formData.downPayment < 0) newErrors.downPayment = 'Entrada não pode ser negativa'
        if (selectedLot && formData.downPayment > selectedLot.price) {
          newErrors.downPayment = 'Entrada não pode ser maior que o valor do lote'
        }
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length))
    }
  }

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return

    setLoading(true)
    try {
      const url = sale ? `/api/sales/${sale.id}` : '/api/sales'
      const method = sale ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao salvar venda')
      }

      onSave()
      onClose()
    } catch (error) {
      console.error('Error saving sale:', error)
      setErrors({ submit: error instanceof Error ? error.message : 'Erro ao salvar venda' })
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl bg-white dark:bg-gray-800 rounded-md shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {sale ? 'Editar Venda' : 'Nova Venda'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {/* Progress Steps */}
        <div className="py-4">
          <nav aria-label="Progress">
            <ol className="flex items-center">
              {STEPS.map((step, stepIdx) => (
                <li key={step.id} className={`${stepIdx !== STEPS.length - 1 ? 'flex-1' : ''}`}>
                  <div className="flex items-center">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                      currentStep >= step.id
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-gray-300 text-gray-500'
                    }`}>
                      {currentStep > step.id ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <span className="text-sm font-medium">{step.id}</span>
                      )}
                    </div>
                    <div className="ml-3">
                      <p className={`text-sm font-medium ${
                        currentStep >= step.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500'
                      }`}>
                        {step.name}
                      </p>
                    </div>
                    {stepIdx !== STEPS.length - 1 && (
                      <div className="flex-1 ml-4">
                        <div className={`h-0.5 ${
                          currentStep > step.id ? 'bg-indigo-600' : 'bg-gray-300'
                        }`} />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </nav>
        </div>

        {errors.submit && (
          <div className="mb-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded-md p-4">
            <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
          </div>
        )}

        {/* Step Content */}
        <div className="py-6">
          {currentStep === 1 && (
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">Selecionar Cliente</h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Buscar Cliente
                </label>
                <input
                  type="text"
                  placeholder="Digite nome, email ou CPF..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className="max-h-64 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md">
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    onClick={() => handleInputChange('customerId', customer.id)}
                    className={`p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600 last:border-b-0 ${
                      formData.customerId === customer.id ? 'bg-indigo-50 dark:bg-indigo-900' : ''
                    }`}
                  >
                    <div className="font-medium text-gray-900 dark:text-white">{customer.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{customer.email}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">CPF: {customer.cpf}</div>
                  </div>
                ))}
              </div>
              {errors.customerId && <p className="text-sm text-red-600 dark:text-red-400">{errors.customerId}</p>}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">Selecionar Lote</h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Buscar Lote
                </label>
                <input
                  type="text"
                  placeholder="Digite bloco ou número do lote..."
                  value={lotSearch}
                  onChange={(e) => setLotSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className="max-h-64 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md">
                {filteredLots.map((lot) => (
                  <div
                    key={lot.id}
                    onClick={() => handleInputChange('lotId', lot.id)}
                    className={`p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600 last:border-b-0 ${
                      formData.lotId === lot.id ? 'bg-indigo-50 dark:bg-indigo-900' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          Bloco {lot.block.identifier} - Lote {lot.identifier}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Área: {lot.totalArea.toFixed(2)} m²
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Status: {lot.status === 'available' ? 'Disponível' : lot.status}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(lot.price)}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {formatCurrency(lot.price / lot.totalArea)}/m²
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {errors.lotId && <p className="text-sm text-red-600 dark:text-red-400">{errors.lotId}</p>}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">Termos de Pagamento</h4>
              
              {selectedLot && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900 dark:text-white">
                      Valor do Lote:
                    </span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatCurrency(selectedLot.price)}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Valor de Entrada
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={selectedLot?.price || 0}
                    value={formData.downPayment}
                    onChange={(e) => handleInputChange('downPayment', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                  />
                  {errors.downPayment && <p className="text-sm text-red-600 dark:text-red-400">{errors.downPayment}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Número de Parcelas
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="240"
                    value={formData.installmentCount}
                    onChange={(e) => handleInputChange('installmentCount', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                  />
                  {errors.installmentCount && <p className="text-sm text-red-600 dark:text-red-400">{errors.installmentCount}</p>}
                </div>
              </div>

              <div className="flex items-center">
                <input
                  id="annual-adjustment"
                  type="checkbox"
                  checked={formData.annualAdjustment}
                  onChange={(e) => handleInputChange('annualAdjustment', e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="annual-adjustment" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Reajuste anual das parcelas
                </label>
              </div>

              {selectedLot && (
                <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-md space-y-2">
                  <h5 className="font-medium text-blue-900 dark:text-blue-200">Resumo do Pagamento:</h5>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-blue-700 dark:text-blue-300">Entrada:</span>
                      <span className="ml-2 font-medium text-blue-900 dark:text-blue-200">
                        {formatCurrency(formData.downPayment)}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-700 dark:text-blue-300">Valor Financiado:</span>
                      <span className="ml-2 font-medium text-blue-900 dark:text-blue-200">
                        {formatCurrency(selectedLot.price - formData.downPayment)}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-700 dark:text-blue-300">Parcelas:</span>
                      <span className="ml-2 font-medium text-blue-900 dark:text-blue-200">
                        {formData.installmentCount}x {formatCurrency(formData.installmentValue)}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-700 dark:text-blue-300">Total:</span>
                      <span className="ml-2 font-medium text-blue-900 dark:text-blue-200">
                        {formatCurrency(formData.totalValue)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">Confirmar Venda</h4>
              
              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg space-y-4">
                <div>
                  <h5 className="font-medium text-gray-900 dark:text-white mb-2">Cliente</h5>
                  {selectedCustomer && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <p>{selectedCustomer.name}</p>
                      <p>{selectedCustomer.email}</p>
                      <p>CPF: {selectedCustomer.cpf}</p>
                    </div>
                  )}
                </div>

                <div>
                  <h5 className="font-medium text-gray-900 dark:text-white mb-2">Lote</h5>
                  {selectedLot && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <p>Bloco {selectedLot.block.identifier} - Lote {selectedLot.identifier}</p>
                      <p>Área: {selectedLot.totalArea.toFixed(2)} m²</p>
                      <p>Valor: {formatCurrency(selectedLot.price)}</p>
                    </div>
                  )}
                </div>

                <div>
                  <h5 className="font-medium text-gray-900 dark:text-white mb-2">Pagamento</h5>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <p>Entrada: {formatCurrency(formData.downPayment)}</p>
                    <p>Parcelas: {formData.installmentCount}x {formatCurrency(formData.installmentValue)}</p>
                    <p>Reajuste anual: {formData.annualAdjustment ? 'Sim' : 'Não'}</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Total: {formatCurrency(formData.totalValue)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md"
              disabled={loading}
            >
              Cancelar
            </button>

            {currentStep < STEPS.length ? (
              <button
                onClick={nextStep}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
              >
                Próximo
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Salvando...' : (sale ? 'Atualizar Venda' : 'Finalizar Venda')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}