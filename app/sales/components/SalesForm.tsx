'use client'

import { useEffect, useState } from 'react'

interface Block {
  id: string
  identifier: string
  development?: {
    id: string
    name: string
    settings?: {
      minDownPaymentPercentage: number
      maxInstallments: number
      defaultInterestRate: number
      interestCalculation: string
      correctionIndex: string
    } | null
  } | null
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
  firstDueDate?: string | null
  correctionIndex?: string | null
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
  saleEligibility?: {
    userId: string
    canConvert: boolean
    requiresApproval: boolean
    proposalId?: string | null
  } | null
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
  memberships?: {
    development: { id: string; name: string }
    roles: { role: { id: string; name: string } }[]
  }[]
}

interface SaleFormData {
  userId: string
  lotId: string
  reservationId?: string
  proposalId?: string
  installmentCount: number
  installmentValue: number
  downPayment: number
  firstDueDate: string
  annualAdjustment: boolean
  totalValue: number
}

interface SalesFormProps {
  sale?: any | null
  initialData?: {
    userId?: string
    lotId?: string
    reservationId?: string
    proposalId?: string
  } | null
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  correctionReason?: string
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

const MARITAL_STATUS_OPTIONS = [
  { value: '', label: 'Selecione...' },
  { value: 'Solteiro', label: 'Solteiro(a)' },
  { value: 'Casado', label: 'Casado(a)' },
  { value: 'Uniao estavel', label: 'Uniao estavel' },
  { value: 'Separado', label: 'Separado(a)' },
  { value: 'Divorciado', label: 'Divorciado(a)' },
  { value: 'Viuvo', label: 'Viuvo(a)' },
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR')
  }
  return new Date(value).toLocaleDateString('pt-BR')
}

function toDateInputValue(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return formatDateInput(date)
}

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDefaultFirstDueDate() {
  const date = new Date()
  date.setMonth(date.getMonth() + 1)
  return formatDateInput(date)
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

function calculateInstallment(balance: number, installmentCount: number, monthlyInterestRate: number, interestCalculation: string) {
  if (balance <= 0 || installmentCount <= 0) return 0

  const monthlyRate = monthlyInterestRate / 100
  if (monthlyRate <= 0 || interestCalculation === 'none') return balance / installmentCount
  if (interestCalculation === 'simple') return (balance * (1 + monthlyRate * installmentCount)) / installmentCount

  const factor = Math.pow(1 + monthlyRate, installmentCount)
  return (balance * monthlyRate * factor) / (factor - 1)
}

export default function SalesForm({
  sale,
  initialData,
  isOpen,
  onClose,
  onSave,
  correctionReason,
}: SalesFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [lotSearch, setLotSearch] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [paymentTouched, setPaymentTouched] = useState(false)
  const [documentSaving, setDocumentSaving] = useState(false)
  const [documentNotice, setDocumentNotice] = useState<string | null>(null)
  const [documentForm, setDocumentForm] = useState({
    cpf: '',
    rg: '',
    address: '',
    birthDate: '',
    profession: '',
    birthplace: '',
    maritalStatus: '',
  })

  const [formData, setFormData] = useState<SaleFormData>({
    userId: '',
    lotId: '',
    reservationId: '',
    installmentCount: 1,
    installmentValue: 0,
    downPayment: 0,
    firstDueDate: getDefaultFirstDueDate(),
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
        proposalId: sale.proposalId || '',
        installmentCount: sale.installmentCount,
        installmentValue: sale.installmentValue,
        downPayment: sale.downPayment,
        firstDueDate: toDateInputValue(sale.firstDueDate) || getDefaultFirstDueDate(),
        annualAdjustment: sale.annualAdjustment,
        totalValue: sale.totalValue,
      })
    } else {
      setFormData({
        userId: initialData?.userId ?? '',
        lotId: initialData?.lotId ?? '',
        reservationId: initialData?.reservationId ?? '',
        proposalId: initialData?.proposalId ?? '',
        installmentCount: 1,
        installmentValue: 0,
        downPayment: 0,
        firstDueDate: getDefaultFirstDueDate(),
        annualAdjustment: true,
        totalValue: 0,
      })
    }

    setPaymentTouched(false)
    setCurrentStep(!sale && initialData?.userId && initialData?.lotId ? 3 : 1)
    setUserSearch('')
    setLotSearch('')
    setDocumentNotice(null)
    setErrors({})
  }, [isOpen, sale, initialData])

  useEffect(() => {
    if (!isOpen || sale || !initialData) return

    setFormData((prev) => ({
      ...prev,
      userId: initialData.userId ?? prev.userId,
      lotId: initialData.lotId ?? prev.lotId,
      reservationId: initialData.reservationId ?? prev.reservationId,
      proposalId: initialData.proposalId ?? prev.proposalId,
    }))

    if (initialData.userId && initialData.lotId) setCurrentStep(3)
  }, [isOpen, sale, initialData?.userId, initialData?.lotId, initialData?.reservationId, initialData?.proposalId])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/clients?scope=operational')
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
  const latestProposal = selectedLot?.proposals.find((proposal) => proposal.user.id === formData.userId)
  const selectedProposal = latestProposal?.status === 'approved' && (!formData.proposalId || latestProposal.id === formData.proposalId)
    ? latestProposal
    : undefined
  const approvedTermsLocked = Boolean(sale?.proposalId || selectedProposal)
  const proposalNeedsApproval = Boolean(
    !sale && (
      (latestProposal && latestProposal.status !== 'approved') ||
      (
        selectedLot?.saleEligibility?.userId === formData.userId &&
        !selectedLot.saleEligibility.canConvert
      )
    )
  )
  const commercialSettings = selectedLot?.block.development?.settings
  const minimumDownPayment = selectedLot
    ? (selectedLot.price * (commercialSettings?.minDownPaymentPercentage ?? 10)) / 100
    : 0
  const maximumInstallments = commercialSettings?.maxInstallments ?? 120
  const missingDocumentFields = selectedUser
    ? REQUIRED_DOCUMENT_FIELDS.filter((field) => !selectedUser[field.key])
    : REQUIRED_DOCUMENT_FIELDS

  useEffect(() => {
    if (!selectedUser) return
    setDocumentForm({
      cpf: selectedUser.cpf ?? '',
      rg: selectedUser.rg ?? '',
      address: selectedUser.address ?? '',
      birthDate: selectedUser.birthDate ? selectedUser.birthDate.slice(0, 10) : '',
      profession: selectedUser.profession ?? '',
      birthplace: selectedUser.birthplace ?? '',
      maritalStatus: selectedUser.maritalStatus ?? '',
    })
    setDocumentNotice(null)
  }, [selectedUser?.id])

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
    if (!selectedLot || sale) return

    if (selectedProposal) {
      setFormData((prev) => ({
        ...prev,
        reservationId: selectedReservation?.id ?? prev.reservationId,
        proposalId: selectedProposal.id,
        downPayment: selectedProposal.downPayment,
        installmentCount: selectedProposal.installmentCount,
        installmentValue: selectedProposal.installmentValue,
        firstDueDate: toDateInputValue(selectedProposal.firstDueDate) || prev.firstDueDate,
        annualAdjustment: selectedProposal.correctionIndex !== 'none',
        totalValue: selectedProposal.totalValue,
      }))
      return
    }

    setFormData((prev) => {
      const downPayment = paymentTouched ? prev.downPayment : minimumDownPayment
      const installmentCount = paymentTouched ? prev.installmentCount : maximumInstallments
      const remainingValue = Math.max(selectedLot.price - downPayment, 0)
      const installmentValue = Math.round(calculateInstallment(
        remainingValue,
        installmentCount,
        commercialSettings?.defaultInterestRate ?? 0,
        commercialSettings?.interestCalculation ?? 'none',
      ) * 100) / 100

      return {
        ...prev,
        proposalId: '',
        reservationId: selectedReservation?.id ?? prev.reservationId,
        downPayment,
        installmentCount,
        annualAdjustment: commercialSettings?.correctionIndex !== 'none',
        totalValue: downPayment + installmentValue * installmentCount,
        installmentValue,
      }
    })
  }, [
    sale,
    selectedLot?.id,
    selectedProposal?.id,
    selectedReservation?.id,
    paymentTouched,
    formData.downPayment,
    formData.installmentCount,
    minimumDownPayment,
    maximumInstallments,
    commercialSettings?.defaultInterestRate,
    commercialSettings?.interestCalculation,
    commercialSettings?.correctionIndex,
  ])

  const handleInputChange = (field: keyof SaleFormData, value: any) => {
    if (field === 'userId' || field === 'lotId') setPaymentTouched(false)
    if (field === 'downPayment' || field === 'installmentCount' || field === 'installmentValue' || field === 'firstDueDate') setPaymentTouched(true)
    setFormData((prev) => ({
      ...prev,
      ...(field === 'userId' || field === 'lotId' ? { proposalId: '' } : {}),
      [field]: value,
    }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const validateStep = (step: number) => {
    const newErrors: Record<string, string> = {}

    if (step === 1 && !formData.userId) newErrors.userId = 'Selecione um cliente'
    if (step === 2 && !formData.lotId) newErrors.lotId = 'Selecione um lote'
    if (step === 3) {
      if (proposalNeedsApproval) {
        newErrors.proposal = 'A proposta mais recente precisa ser aprovada antes de gerar a venda.'
      }
      if (formData.installmentCount < 1) newErrors.installmentCount = 'Minimo 1 parcela'
      if (formData.downPayment < 0) newErrors.downPayment = 'Entrada nao pode ser negativa'
      if (selectedLot && formData.downPayment > selectedLot.price) newErrors.downPayment = 'Entrada nao pode ser maior que o valor do lote'
      if (!approvedTermsLocked && formData.downPayment < minimumDownPayment) {
        newErrors.downPayment = `Entrada minima: ${formatCurrency(minimumDownPayment)}`
      }
      if (!approvedTermsLocked && formData.installmentCount > maximumInstallments) {
        newErrors.installmentCount = `Maximo de ${maximumInstallments} parcelas`
      }
      if (!formData.firstDueDate) newErrors.firstDueDate = 'Informe o primeiro vencimento'
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
        body: JSON.stringify({
          ...formData,
          correctionReason,
        }),
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

  const updateDocumentField = (field: keyof typeof documentForm, value: string) => {
    setDocumentForm((current) => ({ ...current, [field]: value }))
    if (errors.documents) setErrors((current) => ({ ...current, documents: '' }))
  }

  const saveClientDocuments = async () => {
    if (!selectedUser) return

    const missing = REQUIRED_DOCUMENT_FIELDS.filter((field) => {
      const value = documentForm[field.key as keyof typeof documentForm]
      return !String(value ?? '').trim()
    })
    if (missing.length > 0) {
      setErrors((current) => ({
        ...current,
        documents: `Complete os dados do cliente: ${missing.map((field) => field.label).join(', ')}`,
      }))
      return
    }

    try {
      setDocumentSaving(true)
      setErrors((current) => ({ ...current, documents: '' }))
      setDocumentNotice(null)

      const memberships = selectedUser.memberships?.map((membership) => ({
        developmentId: membership.development.id,
        roleId: membership.roles[0]?.role.id ?? '',
      })) ?? []

      const response = await fetch(`/api/clients/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedUser.name,
          email: selectedUser.email,
          ...documentForm,
          memberships,
        }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Erro ao atualizar dados do cliente')
      }

      const updatedUser = await response.json()
      setUsers((current) => current.map((user) => (user.id === updatedUser.id ? { ...user, ...updatedUser } : user)))
      setDocumentNotice('Dados do cliente salvos. Voce ja pode avancar para a revisao.')
    } catch (error) {
      setErrors((current) => ({
        ...current,
        documents: error instanceof Error ? error.message : 'Erro ao atualizar dados do cliente',
      }))
    } finally {
      setDocumentSaving(false)
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
                    <p className='mt-1 text-sm text-muted'>
                      {approvedTermsLocked
                        ? 'Condicoes bloqueadas conforme a proposta aprovada.'
                        : 'Venda direta sujeita as regras comerciais do empreendimento.'}
                    </p>
                  </div>
                  {proposalNeedsApproval && (
                    <div className='rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800'>
                      A proposta mais recente ainda nao esta aprovada. A venda so pode continuar depois da aprovacao.
                    </div>
                  )}
                  {approvedTermsLocked && (
                    <div className='rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800'>
                      Esta venda utiliza uma proposta aprovada. Para mudar valores, crie uma nova proposta e submeta novamente para aprovacao.
                    </div>
                  )}
                  {!approvedTermsLocked && selectedLot && (
                    <div className='rounded-2xl border border-border bg-surface-secondary px-5 py-4 text-sm text-muted'>
                      Preco-base {formatCurrency(selectedLot.price)}
                      {(commercialSettings?.defaultInterestRate ?? 0) > 0
                        ? ` · Juros padrao de ${commercialSettings?.defaultInterestRate}% ao mes`
                        : ' · Sem juros'}
                    </div>
                  )}
                  {errors.proposal && <p className='text-sm font-medium text-red-600'>{errors.proposal}</p>}
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
                          disabled={approvedTermsLocked}
                          className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-muted'
                        />
                        {!approvedTermsLocked && (
                          <p className='mt-2 text-xs font-semibold text-muted'>Minimo: {formatCurrency(minimumDownPayment)}</p>
                        )}
                        {errors.downPayment && <p className='mt-2 text-sm font-medium text-red-600'>{errors.downPayment}</p>}
                      </label>
                      <label className='block'>
                        <span className='mb-2 block text-sm font-semibold text-foreground'>Numero de parcelas</span>
                        <input
                          type='number'
                          min='1'
                          max={maximumInstallments}
                          value={formData.installmentCount}
                          onChange={(event) => handleInputChange('installmentCount', parseInt(event.target.value) || 1)}
                          disabled={approvedTermsLocked}
                          className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-muted'
                        />
                        {!approvedTermsLocked && (
                          <p className='mt-2 text-xs font-semibold text-muted'>Maximo: {maximumInstallments} parcelas</p>
                        )}
                        {errors.installmentCount && <p className='mt-2 text-sm font-medium text-red-600'>{errors.installmentCount}</p>}
                      </label>
                      <label className='block'>
                        <span className='mb-2 block text-sm font-semibold text-foreground'>Primeiro vencimento</span>
                        <input
                          type='date'
                          value={formData.firstDueDate}
                          onChange={(event) => handleInputChange('firstDueDate', event.target.value)}
                          disabled={approvedTermsLocked}
                          className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-muted'
                        />
                        {errors.firstDueDate && <p className='mt-2 text-sm font-medium text-red-600'>{errors.firstDueDate}</p>}
                      </label>
                    </div>
                    <label className='mt-5 flex items-center gap-3 text-sm font-semibold text-foreground'>
                      <input
                        id='annual-adjustment'
                        type='checkbox'
                        checked={formData.annualAdjustment}
                        onChange={(event) => handleInputChange('annualAdjustment', event.target.checked)}
                        disabled={approvedTermsLocked}
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
                      <span className='text-muted'>Primeiro vencimento</span>
                      <span className='font-semibold text-foreground'>{formatDate(formData.firstDueDate)}</span>
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
                  <p className='mt-1 text-sm text-muted'>Complete os dados contratuais sem sair do fluxo de venda.</p>
                </div>
                {documentNotice && (
                  <div className='rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'>
                    {documentNotice}
                  </div>
                )}
                {errors.documents && (
                  <div className='rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
                    {errors.documents}
                  </div>
                )}
                <div className='grid gap-4 md:grid-cols-2'>
                  <label className='block'>
                    <span className='mb-2 block text-sm font-semibold text-foreground'>CPF</span>
                    <input
                      value={documentForm.cpf}
                      onChange={(event) => updateDocumentField('cpf', event.target.value)}
                      className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                    />
                  </label>
                  <label className='block'>
                    <span className='mb-2 block text-sm font-semibold text-foreground'>RG</span>
                    <input
                      value={documentForm.rg}
                      onChange={(event) => updateDocumentField('rg', event.target.value)}
                      className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                    />
                  </label>
                  <label className='block'>
                    <span className='mb-2 block text-sm font-semibold text-foreground'>Data de nascimento</span>
                    <input
                      type='date'
                      value={documentForm.birthDate}
                      onChange={(event) => updateDocumentField('birthDate', event.target.value)}
                      className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                    />
                  </label>
                  <label className='block'>
                    <span className='mb-2 block text-sm font-semibold text-foreground'>Profissao</span>
                    <input
                      value={documentForm.profession}
                      onChange={(event) => updateDocumentField('profession', event.target.value)}
                      className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                    />
                  </label>
                  <label className='block'>
                    <span className='mb-2 block text-sm font-semibold text-foreground'>Naturalidade</span>
                    <input
                      value={documentForm.birthplace}
                      onChange={(event) => updateDocumentField('birthplace', event.target.value)}
                      className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                    />
                  </label>
                  <label className='block'>
                    <span className='mb-2 block text-sm font-semibold text-foreground'>Estado civil</span>
                    <select
                      value={documentForm.maritalStatus}
                      onChange={(event) => updateDocumentField('maritalStatus', event.target.value)}
                      className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                    >
                      {MARITAL_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className='block md:col-span-2'>
                    <span className='mb-2 block text-sm font-semibold text-foreground'>Endereco</span>
                    <textarea
                      rows={3}
                      value={documentForm.address}
                      onChange={(event) => updateDocumentField('address', event.target.value)}
                      className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                    />
                  </label>
                </div>
                <div className='flex flex-col gap-3 md:flex-row md:items-center'>
                  <button
                    type='button'
                    onClick={saveClientDocuments}
                    disabled={documentSaving}
                    className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-60'
                  >
                    {documentSaving ? 'Salvando...' : 'Salvar dados do cliente'}
                  </button>
                  {missingDocumentFields.length === 0 && (
                    <span className='pill bg-emerald-50 text-emerald-700'>Dados completos</span>
                  )}
                </div>
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
                      <p>Primeiro vencimento: <span className='font-semibold text-foreground'>{formatDate(formData.firstDueDate)}</span></p>
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
                    disabled={loading || proposalNeedsApproval}
                    className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-60'
                  >
                    {loading
                      ? 'Salvando...'
                      : proposalNeedsApproval
                      ? 'Aguardando aprovacao'
                      : sale
                      ? 'Atualizar venda'
                      : 'Finalizar venda'}
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
