'use client'

import { useEffect, useState } from 'react'

interface Block {
  id: string
  identifier: string
}

interface ReservationSummary {
  id: string
  status: string
  cancelledAt?: string | null
  user: {
    id: string
    name: string
    email: string
  }
}

interface ProposalSummary {
  id: string
  status: string
  downPayment: number
  installmentCount: number
  installmentValue: number
  totalValue: number
  user: {
    id: string
    name: string
    email: string
  }
}

interface Lot {
  id: string
  identifier: string
  totalArea: number
  price: number
  status: string
  block: Block
  reservations: ReservationSummary[]
  proposals: ProposalSummary[]
}

interface User {
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
}

interface SaleFormData {
  userId: string
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
  initialData?: {
    userId?: string
    lotId?: string
    reservationId?: string
  } | null
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

const STEPS = [
  { id: 1, name: 'Cliente', description: 'Selecionar cliente' },
  { id: 2, name: 'Lote', description: 'Escolher lote' },
  { id: 3, name: 'Pagamento', description: 'Termos comerciais' },
  { id: 4, name: 'Documentos', description: 'Dados obrigatorios' },
  { id: 5, name: 'Revisao', description: 'Confirmar venda' },
]

const REQUIRED_DOCUMENT_FIELDS: { key: keyof User; label: string }[] = [
  { key: 'cpf', label: 'CPF' },
  { key: 'rg', label: 'RG' },
  { key: 'address', label: 'Endereco' },
  { key: 'birthDate', label: 'Data de nascimento' },
  { key: 'profession', label: 'Profissao' },
  { key: 'birthplace', label: 'Naturalidade' },
  { key: 'maritalStatus', label: 'Estado civil' },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatArea(value: number) {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m2`
}

function formatDate(value?: string | null) {
  if (!value) return 'Pendente'
  return new Date(value).toLocaleDateString('pt-BR')
}

function getInitials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2)
}

function getLotStatusLabel(status: string) {
  if (status === 'available') return 'Disponivel'
  if (status === 'reserved') return 'Reservado'
  if (status === 'on_hold') return 'Bloqueado'
  if (status === 'sold') return 'Vendido'
  return status
}

export default function SalesForm({
  sale,
  initialData,
  isOpen,
  onClose,
  onSave,
}: SalesFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [lotSearch, setLotSearch] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [paymentTouched, setPaymentTouched] = useState(false)

  const [formData, setFormData] = useState<SaleFormData>({
    userId: '',
    lotId: '',
    reservationId: '',
    installmentCount: 1,
    installmentValue: 0,
    downPayment: 0,
    annualAdjustment: true,
    totalValue: 0,
  })

  useEffect(() => {
    if (!isOpen) return

    void fetchUsers()
    void fetchAvailableLots()

    if (sale) {
      setFormData({
        userId: sale.userId,
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
        userId: initialData?.userId ?? '',
        lotId: initialData?.lotId ?? '',
        reservationId: initialData?.reservationId ?? '',
        installmentCount: 1,
        installmentValue: 0,
        downPayment: 0,
        annualAdjustment: true,
        totalValue: 0,
      })
    }

    setPaymentTouched(false)
    setCurrentStep(!sale && initialData?.userId && initialData?.lotId ? 3 : 1)
    setUserSearch('')
    setLotSearch('')
    setErrors({})
  }, [isOpen, sale, initialData])

  useEffect(() => {
    if (!isOpen || sale || !initialData) return

    setFormData((prev) => ({
      ...prev,
      userId: initialData.userId ?? prev.userId,
      lotId: initialData.lotId ?? prev.lotId,
      reservationId: initialData.reservationId ?? prev.reservationId,
    }))

    if (initialData.userId && initialData.lotId) setCurrentStep(3)
  }, [isOpen, sale, initialData?.userId, initialData?.lotId, initialData?.reservationId])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/clients')
      if (response.ok) setUsers(await response.json())
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchAvailableLots = async () => {
    try {
      const response = await fetch('/api/lots')
      if (!response.ok) return
      const data = await response.json()
      const availableLots = sale
        ? data
        : data.filter((lot: Lot) => lot.status === 'available' || lot.status === 'reserved' || lot.status === 'on_hold')
      setLots(availableLots)
    } catch (error) {
      console.error('Error fetching lots:', error)
    }
  }

  const selectedUser = users.find((user) => user.id === formData.userId)
  const selectedLot = lots.find((lot) => lot.id === formData.lotId)
  const selectedReservation = selectedLot?.reservations.find(
    (reservation) => !reservation.cancelledAt && reservation.status !== 'cancelled' && reservation.user.id === formData.userId,
  )
  const selectedProposal = selectedLot?.proposals.find((proposal) => proposal.user.id === formData.userId)
  const missingDocumentFields = selectedUser
    ? REQUIRED_DOCUMENT_FIELDS.filter((field) => !selectedUser[field.key])
    : REQUIRED_DOCUMENT_FIELDS

  const filteredUsers = users.filter((user) => {
    if (!userSearch) return true
    const searchLower = userSearch.toLowerCase()
    const digits = userSearch.replace(/\D/g, '')
    return (
      user.name.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      Boolean(digits && user.cpf?.replace(/\D/g, '').includes(digits))
    )
  })

  const filteredLots = lots.filter((lot) => {
    const activeReservation = lot.reservations.find((reservation) => !reservation.cancelledAt && reservation.status !== 'cancelled')
    if (activeReservation && activeReservation.user.id !== formData.userId) return false

    if (!lotSearch) return true
    const searchLower = lotSearch.toLowerCase()
    return (
      lot.identifier.toLowerCase().includes(searchLower) ||
      lot.block.identifier.toLowerCase().includes(searchLower) ||
      `${lot.block.identifier}${lot.identifier}`.toLowerCase().includes(searchLower)
    )
  })

  useEffect(() => {
    if (!selectedLot || formData.installmentCount <= 0) return

    if (selectedProposal && !paymentTouched) {
      setFormData((prev) => ({
        ...prev,
        reservationId: selectedReservation?.id ?? prev.reservationId,
        downPayment: selectedProposal.downPayment,
        installmentCount: selectedProposal.installmentCount,
        installmentValue: selectedProposal.installmentValue,
        totalValue: selectedProposal.totalValue,
      }))
      return
    }

    const remainingValue = selectedLot.price - formData.downPayment
    const installmentValue = Math.round((remainingValue / formData.installmentCount) * 100) / 100

    setFormData((prev) => ({
      ...prev,
      reservationId: selectedReservation?.id ?? prev.reservationId,
      totalValue: selectedLot.price,
      installmentValue: Math.max(0, installmentValue),
    }))
  }, [
    selectedLot?.id,
    selectedProposal?.id,
    selectedReservation?.id,
    paymentTouched,
    formData.downPayment,
    formData.installmentCount,
  ])

  const handleInputChange = (field: keyof SaleFormData, value: any) => {
    if (field === 'userId' || field === 'lotId') setPaymentTouched(false)
    if (field === 'downPayment' || field === 'installmentCount' || field === 'installmentValue') setPaymentTouched(true)
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const validateStep = (step: number) => {
    const newErrors: Record<string, string> = {}

    if (step === 1 && !formData.userId) newErrors.userId = 'Selecione um cliente'
    if (step === 2 && !formData.lotId) newErrors.lotId = 'Selecione um lote'
    if (step === 3) {
      if (formData.installmentCount < 1) newErrors.installmentCount = 'Minimo 1 parcela'
      if (formData.downPayment < 0) newErrors.downPayment = 'Entrada nao pode ser negativa'
      if (selectedLot && formData.downPayment > selectedLot.price) newErrors.downPayment = 'Entrada nao pode ser maior que o valor do lote'
    }
    if (step === 4 && missingDocumentFields.length > 0) {
      newErrors.documents = `Complete os dados do cliente: ${missingDocumentFields.map((field) => field.label).join(', ')}`
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => {
    if (validateStep(currentStep)) setCurrentStep((prev) => Math.min(prev + 1, STEPS.length))
  }

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return

    setLoading(true)
    try {
      const url = sale ? `/api/sales/${sale.id}` : '/api/sales'
      const method = sale ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
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
      setErrors({
        submit: error instanceof Error ? error.message : 'Erro ao salvar venda',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <button
        type='button'
        aria-label='Fechar venda'
        className='fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px] lg:left-[290px]'
        onClick={onClose}
      />
      <aside className='fixed inset-y-0 right-0 z-50 w-full max-w-5xl border-l border-border bg-surface shadow-2xl'>
        <div className='flex h-full flex-col'>
          <div className='border-b border-border px-6 py-5'>
            <div className='flex items-start justify-between gap-4'>
              <div>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-muted'>Fluxo guiado</p>
                <h2 className='mt-2 text-2xl font-bold text-foreground'>{sale ? 'Editar venda' : 'Nova venda'}</h2>
                <p className='mt-2 text-sm leading-6 text-muted'>Selecione cliente, lote, condicao de pagamento, documentos e revise antes de confirmar.</p>
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

            <div className='mt-5 grid gap-2 sm:grid-cols-5'>
              {STEPS.map((step) => (
                <button
                  key={step.id}
                  type='button'
                  onClick={() => {
                    if (step.id <= currentStep || validateStep(currentStep)) setCurrentStep(step.id)
                  }}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    currentStep === step.id
                      ? 'border-primary bg-primary/8 text-primary'
                      : currentStep > step.id
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-border bg-surface-secondary text-muted hover:bg-background'
                  }`}
                >
                  <span className='block text-xs font-semibold uppercase'>Etapa {step.id}</span>
                  <span className='mt-1 block text-sm font-semibold'>{step.name}</span>
                </button>
              ))}
            </div>

            {errors.submit && (
              <div className='mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
                {errors.submit}
              </div>
            )}
          </div>

          <div className='flex-1 overflow-y-auto px-6 py-6'>
            {currentStep === 1 && (
              <section className='space-y-5'>
                <div>
                  <h3 className='text-base font-semibold text-foreground'>Cliente</h3>
                  <p className='mt-1 text-sm text-muted'>Escolha o comprador da venda.</p>
                </div>
                {selectedUser && (
                  <div className='rounded-2xl border border-primary/30 bg-primary/6 p-4'>
                    <p className='text-xs font-semibold uppercase text-primary'>Cliente selecionado</p>
                    <div className='mt-3 flex items-center gap-4'>
                      <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white'>
                        {getInitials(selectedUser.name)}
                      </span>
                      <span className='min-w-0'>
                        <span className='block text-sm font-semibold text-foreground'>{selectedUser.name}</span>
                        <span className='block truncate text-sm text-muted'>{selectedUser.email}</span>
                      </span>
                    </div>
                  </div>
                )}
                <input
                  type='text'
                  placeholder='Buscar por nome, email ou CPF...'
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                />
                <div className='max-h-[420px] overflow-y-auto rounded-2xl border border-border bg-surface'>
                  {filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      type='button'
                      onClick={() => handleInputChange('userId', user.id)}
                      className={`flex w-full items-center gap-4 border-b border-border px-4 py-3 text-left transition last:border-b-0 hover:bg-surface-secondary ${
                        formData.userId === user.id ? 'bg-primary/6' : ''
                      }`}
                    >
                      <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white'>
                        {getInitials(user.name)}
                      </span>
                      <span className='min-w-0'>
                        <span className='block text-sm font-semibold text-foreground'>{user.name}</span>
                        <span className='block truncate text-sm text-muted'>{user.email}</span>
                        <span className='block text-xs text-muted'>CPF: {user.cpf || 'Nao informado'}</span>
                      </span>
                    </button>
                  ))}
                </div>
                {errors.userId && <p className='text-sm font-medium text-red-600'>{errors.userId}</p>}
              </section>
            )}

            {currentStep === 2 && (
              <section className='space-y-5'>
                <div>
                  <h3 className='text-base font-semibold text-foreground'>Lote</h3>
                  <p className='mt-1 text-sm text-muted'>Lotes reservados para outro cliente ficam ocultos.</p>
                </div>
                {selectedLot && (
                  <div className='rounded-2xl border border-primary/30 bg-primary/6 p-4'>
                    <p className='text-xs font-semibold uppercase text-primary'>Lote selecionado</p>
                    <div className='mt-3 flex items-start justify-between gap-3'>
                      <div>
                        <p className='text-sm font-semibold text-foreground'>Quadra {selectedLot.block.identifier}, Lote {selectedLot.identifier}</p>
                        <p className='mt-1 text-sm text-muted'>{formatArea(selectedLot.totalArea)} · {getLotStatusLabel(selectedLot.status)}</p>
                      </div>
                      <p className='text-sm font-bold text-foreground'>{formatCurrency(selectedLot.price)}</p>
                    </div>
                  </div>
                )}
                <input
                  type='text'
                  placeholder='Buscar por quadra ou lote...'
                  value={lotSearch}
                  onChange={(event) => setLotSearch(event.target.value)}
                  className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                />
                <div className='grid gap-3 md:grid-cols-2'>
                  {filteredLots.map((lot) => (
                    <button
                      key={lot.id}
                      type='button'
                      onClick={() => handleInputChange('lotId', lot.id)}
                      className={`rounded-2xl border p-4 text-left transition hover:bg-surface-secondary ${
                        formData.lotId === lot.id ? 'border-primary bg-primary/6' : 'border-border bg-surface'
                      }`}
                    >
                      <div className='flex items-start justify-between gap-3'>
                        <div>
                          <p className='text-sm font-semibold text-foreground'>Quadra {lot.block.identifier}, Lote {lot.identifier}</p>
                          <p className='mt-1 text-sm text-muted'>{formatArea(lot.totalArea)} · {getLotStatusLabel(lot.status)}</p>
                        </div>
                        <p className='text-sm font-bold text-foreground'>{formatCurrency(lot.price)}</p>
                      </div>
                      <p className='mt-3 text-xs text-muted'>{formatCurrency(lot.price / lot.totalArea)}/m2</p>
                    </button>
                  ))}
                </div>
                {errors.lotId && <p className='text-sm font-medium text-red-600'>{errors.lotId}</p>}
              </section>
            )}

            {currentStep === 3 && (
              <section className='grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]'>
                <div className='space-y-5'>
                  <div>
                    <h3 className='text-base font-semibold text-foreground'>Pagamento</h3>
                    <p className='mt-1 text-sm text-muted'>Ajuste entrada e parcelamento antes de confirmar.</p>
                  </div>
                  <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                    <div className='grid gap-4 md:grid-cols-2'>
                      <label className='block'>
                        <span className='mb-2 block text-sm font-semibold text-foreground'>Valor de entrada</span>
                        <input
                          type='number'
                          step='0.01'
                          min='0'
                          max={selectedLot?.price || 0}
                          value={formData.downPayment}
                          onChange={(event) => handleInputChange('downPayment', parseFloat(event.target.value) || 0)}
                          className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                        />
                        {errors.downPayment && <p className='mt-2 text-sm font-medium text-red-600'>{errors.downPayment}</p>}
                      </label>
                      <label className='block'>
                        <span className='mb-2 block text-sm font-semibold text-foreground'>Numero de parcelas</span>
                        <input
                          type='number'
                          min='1'
                          max='240'
                          value={formData.installmentCount}
                          onChange={(event) => handleInputChange('installmentCount', parseInt(event.target.value) || 1)}
                          className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                        />
                        {errors.installmentCount && <p className='mt-2 text-sm font-medium text-red-600'>{errors.installmentCount}</p>}
                      </label>
                    </div>
                    <label className='mt-5 flex items-center gap-3 text-sm font-semibold text-foreground'>
                      <input
                        id='annual-adjustment'
                        type='checkbox'
                        checked={formData.annualAdjustment}
                        onChange={(event) => handleInputChange('annualAdjustment', event.target.checked)}
                        className='h-4 w-4 rounded border-border text-primary focus:ring-primary'
                      />
                      Reajuste anual das parcelas
                    </label>
                  </div>
                </div>

                <aside className='rounded-2xl border border-border bg-surface-secondary p-5'>
                  <h3 className='text-base font-semibold text-foreground'>Resumo</h3>
                  <div className='mt-5 space-y-4 text-sm'>
                    <div className='rounded-xl border border-border bg-surface px-4 py-4'>
                      <p className='text-xs font-semibold uppercase text-muted'>Parcela</p>
                      <p className='mt-2 text-2xl font-bold text-foreground'>{formatCurrency(formData.installmentValue)}</p>
                    </div>
                    <div className='flex justify-between gap-3'>
                      <span className='text-muted'>Valor do lote</span>
                      <span className='font-semibold text-foreground'>{formatCurrency(selectedLot?.price ?? 0)}</span>
                    </div>
                    <div className='flex justify-between gap-3'>
                      <span className='text-muted'>Entrada</span>
                      <span className='font-semibold text-foreground'>{formatCurrency(formData.downPayment)}</span>
                    </div>
                    <div className='flex justify-between gap-3'>
                      <span className='text-muted'>Saldo</span>
                      <span className='font-semibold text-foreground'>{formatCurrency((selectedLot?.price ?? 0) - formData.downPayment)}</span>
                    </div>
                    <div className='flex justify-between gap-3'>
                      <span className='text-muted'>Total</span>
                      <span className='font-semibold text-foreground'>{formatCurrency(formData.totalValue)}</span>
                    </div>
                  </div>
                </aside>
              </section>
            )}

            {currentStep === 4 && (
              <section className='space-y-5'>
                <div>
                  <h3 className='text-base font-semibold text-foreground'>Documentos</h3>
                  <p className='mt-1 text-sm text-muted'>Todos os dados abaixo precisam estar completos para gerar a venda e contrato.</p>
                </div>
                <div className='grid gap-3 md:grid-cols-2'>
                  {REQUIRED_DOCUMENT_FIELDS.map((field) => {
                    const complete = Boolean(selectedUser?.[field.key])
                    return (
                      <div key={field.key} className={`rounded-2xl border p-4 ${complete ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                        <p className={`text-sm font-semibold ${complete ? 'text-emerald-800' : 'text-amber-800'}`}>{field.label}</p>
                        <p className={`mt-1 text-sm ${complete ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {field.key === 'birthDate' ? formatDate(selectedUser?.birthDate) : String(selectedUser?.[field.key] ?? 'Pendente')}
                        </p>
                      </div>
                    )
                  })}
                </div>
                {errors.documents && (
                  <div className='rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
                    {errors.documents}
                  </div>
                )}
              </section>
            )}

            {currentStep === 5 && (
              <section className='space-y-5'>
                <div>
                  <h3 className='text-base font-semibold text-foreground'>Revisao</h3>
                  <p className='mt-1 text-sm text-muted'>Confirme os dados antes de finalizar a venda.</p>
                </div>
                <div className='grid gap-4 lg:grid-cols-3'>
                  <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                    <h4 className='text-sm font-semibold text-foreground'>Cliente</h4>
                    <div className='mt-3 text-sm leading-6 text-muted'>
                      <p className='font-semibold text-foreground'>{selectedUser?.name}</p>
                      <p>{selectedUser?.email}</p>
                      <p>CPF: {selectedUser?.cpf || 'Nao informado'}</p>
                    </div>
                  </div>
                  <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                    <h4 className='text-sm font-semibold text-foreground'>Lote</h4>
                    <div className='mt-3 text-sm leading-6 text-muted'>
                      <p className='font-semibold text-foreground'>Quadra {selectedLot?.block.identifier}, Lote {selectedLot?.identifier}</p>
                      <p>{formatArea(selectedLot?.totalArea ?? 0)}</p>
                      <p>{formatCurrency(selectedLot?.price ?? 0)}</p>
                    </div>
                  </div>
                  <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                    <h4 className='text-sm font-semibold text-foreground'>Pagamento</h4>
                    <div className='mt-3 text-sm leading-6 text-muted'>
                      <p>Entrada: <span className='font-semibold text-foreground'>{formatCurrency(formData.downPayment)}</span></p>
                      <p>{formData.installmentCount}x de <span className='font-semibold text-foreground'>{formatCurrency(formData.installmentValue)}</span></p>
                      <p>Total: <span className='font-semibold text-foreground'>{formatCurrency(formData.totalValue)}</span></p>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>

          <div className='border-t border-border px-6 py-5'>
            <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
              <button
                type='button'
                onClick={prevStep}
                disabled={currentStep === 1}
                className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary disabled:opacity-50'
              >
                Anterior
              </button>

              <div className='flex flex-col gap-3 md:flex-row'>
                <button
                  type='button'
                  onClick={onClose}
                  disabled={loading}
                  className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary disabled:opacity-60'
                >
                  Cancelar
                </button>
                {currentStep < STEPS.length ? (
                  <button
                    type='button'
                    onClick={nextStep}
                    className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong'
                  >
                    Proximo
                  </button>
                ) : (
                  <button
                    type='button'
                    onClick={handleSubmit}
                    disabled={loading}
                    className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-60'
                  >
                    {loading ? 'Salvando...' : sale ? 'Atualizar venda' : 'Finalizar venda'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
