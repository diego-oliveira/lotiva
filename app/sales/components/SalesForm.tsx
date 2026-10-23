'use client'

import { useEffect, useMemo, useState } from 'react'
import { NumberTextInput } from '@/app/components/NumberTextInput'

interface Block {
  id: string
  identifier: string
  development?: {
    id: string
    name: string
    settings?: {
      minDownPaymentPercentage: number
      allowDownPaymentInstallments: boolean
      maxDownPaymentInstallments: number
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
  salePrice: number
  downPayment: number
  downPaymentInstallmentCount?: number
  downPaymentFirstDueDate?: string | null
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
  addressNumber?: string | null
  addressComplement?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  birthDate?: string | null
  profession?: string | null
  birthplace?: string | null
  maritalStatus?: string | null
  memberships?: {
    development: { id: string; name: string }
    roles: { role: { id: string; name: string } }[]
  }[]
  companyMemberships?: {
    company: { id: string; name: string }
    roles: { role: { id: string; name: string } }[]
  }[]
}

interface SaleFormData {
  userId: string
  coBuyerId: string
  relationshipType: 'spouse' | 'partner' | 'independent'
  lotId: string
  reservationId?: string
  proposalId?: string
  salePrice: number
  installmentCount: number
  installmentValue: number
  downPayment: number
  downPaymentInstallmentCount: number
  downPaymentFirstDueDate: string
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
  developmentId?: string
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
  { key: 'neighborhood', label: 'Bairro' },
  { key: 'city', label: 'Cidade' },
  { key: 'state', label: 'UF' },
  { key: 'zipCode', label: 'CEP' },
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

function getMinimumBalanceDueDate(saleDate: Date, downPaymentInstallmentCount: number) {
  const date = new Date(saleDate)
  date.setMonth(date.getMonth() + Math.max(downPaymentInstallmentCount, 1))
  return formatDateInput(date)
}

function getDocumentFormatError(form: { cpf: string; zipCode: string; state: string; birthDate: string }) {
  if (form.cpf && form.cpf.replace(/\D/g, '').length !== 11) return 'CPF deve ter 11 digitos.'
  if (form.zipCode && form.zipCode.replace(/\D/g, '').length !== 8) return 'CEP deve ter 8 digitos.'
  if (form.state && !/^[A-Za-z]{2}$/.test(form.state)) return 'UF deve ter 2 letras.'
  if (form.birthDate) {
    const birthDate = new Date(`${form.birthDate}T12:00:00`)
    if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) return 'Informe uma data de nascimento valida.'
  }
  return ''
}

function getAutosaveLabel(status: 'idle' | 'saving' | 'saved' | 'error') {
  if (status === 'saving') return 'Salvando...'
  if (status === 'saved') return 'Alteracoes salvas ✓'
  if (status === 'error') return 'Revise os campos destacados'
  return ''
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

const lotStatusMeta: Record<string, { label: string; tile: string; badge: string; dot: string }> = {
  available: {
    label: 'Disponivel',
    tile: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
    badge: 'bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  reserved: {
    label: 'Reservado',
    tile: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
    badge: 'bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
  },
  on_hold: {
    label: 'Bloqueado',
    tile: 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200',
    badge: 'bg-slate-100 text-slate-700',
    dot: 'bg-slate-500',
  },
}

function getLotCardMeta(status: string) {
  return lotStatusMeta[status] ?? {
    label: getLotStatusLabel(status),
    tile: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
    badge: 'bg-slate-100 text-slate-700',
    dot: 'bg-slate-400',
  }
}

function compareNatural(a: string, b: string) {
  return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })
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
  developmentId,
  onClose,
  onSave,
  correctionReason,
}: SalesFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [chosenDevelopmentId, setChosenDevelopmentId] = useState('')
  const formDevelopmentId = developmentId || chosenDevelopmentId
  const [userSearch, setUserSearch] = useState('')
  const [lotSearch, setLotSearch] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [paymentTouched, setPaymentTouched] = useState(false)
  const [documentSaving, setDocumentSaving] = useState(false)
  const [documentDirty, setDocumentDirty] = useState(false)
  const [primaryDocumentDirty, setPrimaryDocumentDirty] = useState(false)
  const [additionalDocumentDirty, setAdditionalDocumentDirty] = useState(false)
  const [primarySaveStatus, setPrimarySaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [additionalSaveStatus, setAdditionalSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [documentNotice, setDocumentNotice] = useState<string | null>(null)
  const [activeDocumentPerson, setActiveDocumentPerson] = useState<'primary' | 'additional' | 'none'>('primary')
  const [showAdditionalPerson, setShowAdditionalPerson] = useState(false)
  const [sameAddressAsPrimary, setSameAddressAsPrimary] = useState(true)
  const [showQuickCoBuyerForm, setShowQuickCoBuyerForm] = useState(false)
  const [coBuyerSearch, setCoBuyerSearch] = useState('')
  const [quickCoBuyer, setQuickCoBuyer] = useState({ name: '', email: '' })
  const [quickCoBuyerSaving, setQuickCoBuyerSaving] = useState(false)
  const [documentForm, setDocumentForm] = useState({
    cpf: '',
    rg: '',
    address: '',
    addressNumber: '',
    addressComplement: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: '',
    birthDate: '',
    profession: '',
    birthplace: '',
    maritalStatus: '',
  })
  const [coBuyerDocumentForm, setCoBuyerDocumentForm] = useState({ cpf: '', rg: '', address: '', addressNumber: '', addressComplement: '', neighborhood: '', city: '', state: '', zipCode: '', birthDate: '', profession: '', birthplace: '', maritalStatus: '' })

  const [formData, setFormData] = useState<SaleFormData>({
    userId: '',
    coBuyerId: '',
    relationshipType: 'independent',
    lotId: '',
    reservationId: '',
    installmentCount: 1,
    salePrice: 0,
    installmentValue: 0,
    downPayment: 0,
    downPaymentInstallmentCount: 1,
    downPaymentFirstDueDate: formatDateInput(new Date()),
    firstDueDate: getDefaultFirstDueDate(),
    annualAdjustment: true,
    totalValue: 0,
  })

  const minimumBalanceDueDate = useMemo(() => {
    if (formData.downPayment <= 0) return ''
    const entryDate = new Date(`${formData.downPaymentFirstDueDate}T12:00:00`)
    if (Number.isNaN(entryDate.getTime())) return ''
    return getMinimumBalanceDueDate(entryDate, formData.downPaymentInstallmentCount)
  }, [formData.downPayment, formData.downPaymentFirstDueDate, formData.downPaymentInstallmentCount])

  useEffect(() => {
    if (!minimumBalanceDueDate || formData.firstDueDate >= minimumBalanceDueDate) return
    setFormData((current) => ({ ...current, firstDueDate: minimumBalanceDueDate }))
  }, [minimumBalanceDueDate, formData.firstDueDate])

  useEffect(() => {
    if (!isOpen) return

    setChosenDevelopmentId('')
    void fetchUsers()
    void fetchAvailableLots()

    if (sale) {
      setFormData({
        userId: sale.userId,
        coBuyerId: sale.participants?.[0]?.userId ?? '',
        relationshipType: sale.participants?.[0]?.relationshipType ?? 'independent',
        lotId: sale.lotId,
        reservationId: sale.reservationId || '',
        proposalId: sale.proposalId || '',
        salePrice: sale.salePrice ?? sale.totalValue,
        installmentCount: sale.installmentCount,
        installmentValue: sale.installmentValue,
        downPayment: sale.downPayment,
        downPaymentInstallmentCount: sale.downPaymentInstallmentCount ?? 1,
        downPaymentFirstDueDate: toDateInputValue(sale.downPaymentFirstDueDate) || formatDateInput(new Date(sale.createdAt ?? Date.now())),
        firstDueDate: toDateInputValue(sale.firstDueDate) || getDefaultFirstDueDate(),
        annualAdjustment: sale.annualAdjustment,
        totalValue: sale.totalValue,
      })
    } else {
      setFormData({
        userId: initialData?.userId ?? '',
        coBuyerId: '',
        relationshipType: 'independent',
        lotId: initialData?.lotId ?? '',
        reservationId: initialData?.reservationId ?? '',
        proposalId: initialData?.proposalId ?? '',
        salePrice: 0,
        installmentCount: 1,
        installmentValue: 0,
        downPayment: 0,
        downPaymentInstallmentCount: 1,
        downPaymentFirstDueDate: formatDateInput(new Date()),
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
    setDocumentDirty(false)
    setPrimaryDocumentDirty(false)
    setPrimarySaveStatus('idle')
    setPrimaryDocumentDirty(false)
    setAdditionalDocumentDirty(false)
    setPrimarySaveStatus('idle')
    setAdditionalSaveStatus('idle')
    setActiveDocumentPerson('primary')
    setShowAdditionalPerson(Boolean(sale?.participants?.[0]))
    setSameAddressAsPrimary(true)
    setShowQuickCoBuyerForm(false)
    setQuickCoBuyer({ name: '', email: '' })
    setCoBuyerSearch('')
    setErrors({})
  }, [isOpen, sale, initialData, developmentId])

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
      const developmentLots = developmentId
        ? data.filter((lot: Lot) => lot.block.development?.id === developmentId)
        : data
      const availableLots = sale
        ? developmentLots
        : developmentLots.filter((lot: Lot) => lot.status === 'available' || lot.status === 'reserved' || lot.status === 'on_hold')
      setLots(availableLots)
    } catch (error) {
      console.error('Error fetching lots:', error)
    }
  }

  const createQuickCoBuyer = () => {
    const targetDevelopmentId = formDevelopmentId || selectedLot?.block.development?.id
    if (!targetDevelopmentId) return setErrors((current) => ({ ...current, coBuyerId: 'Selecione primeiro o empreendimento da venda.' }))
    if (!quickCoBuyer.name.trim() || !quickCoBuyer.email.trim()) return setErrors((current) => ({ ...current, coBuyerId: 'Informe nome e email do conjuge.' }))
    const client = { id: 'new-sale-participant', name: quickCoBuyer.name.trim(), email: quickCoBuyer.email.trim() }
    setUsers((current) => [client, ...current.filter((user) => user.id !== client.id)])
    setFormData((current) => ({ ...current, coBuyerId: client.id, relationshipType: 'spouse' }))
    setDocumentForm((current) => ({ ...current, maritalStatus: 'Casado' }))
    setCoBuyerDocumentForm((current) => ({ ...current, maritalStatus: 'Casado' }))
    setPrimaryDocumentDirty(true)
    setAdditionalDocumentDirty(true)
    setActiveDocumentPerson('additional')
    setCoBuyerSearch(client.name)
    setShowQuickCoBuyerForm(false)
    setDocumentDirty(true)
    setErrors((current) => ({ ...current, coBuyerId: '' }))
  }

  const selectedUser = users.find((user) => user.id === formData.userId)
  const selectedCoBuyer = users.find((user) => user.id === formData.coBuyerId)
  const selectedLot = lots.find((lot) => lot.id === formData.lotId)
  const selectedReservation = selectedLot?.reservations.find(
    (reservation) => !reservation.cancelledAt && reservation.status !== 'cancelled' && reservation.user.id === formData.userId,
  )
  const latestProposal = selectedLot?.proposals.find((proposal) => proposal.user.id === formData.userId)
  const selectedProposal = latestProposal?.status === 'approved' && (!formData.proposalId || latestProposal.id === formData.proposalId)
    ? latestProposal
    : undefined
  const approvedTermsLocked = Boolean(sale?.proposalId || selectedProposal)
  const financialTermsLocked = !sale && approvedTermsLocked
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
  const allowsDownPaymentInstallments = commercialSettings?.allowDownPaymentInstallments ?? false
  const maximumDownPaymentInstallments = allowsDownPaymentInstallments ? commercialSettings?.maxDownPaymentInstallments ?? 1 : 1
  const missingDocumentFields = selectedUser
    ? REQUIRED_DOCUMENT_FIELDS.filter((field) => !selectedUser[field.key])
    : REQUIRED_DOCUMENT_FIELDS
  const missingCoBuyerDocumentFields = selectedCoBuyer
    ? ['cpf', 'rg', 'address', 'neighborhood', 'city', 'state', 'zipCode', 'birthDate', 'profession', 'birthplace', 'maritalStatus'].filter((field) => !coBuyerDocumentForm[field as keyof typeof coBuyerDocumentForm].trim())
    : []

  useEffect(() => {
    if (!selectedUser) return
    setDocumentForm({
      cpf: selectedUser.cpf ?? '',
      rg: selectedUser.rg ?? '',
      address: selectedUser.address ?? '',
      addressNumber: selectedUser.addressNumber ?? '',
      addressComplement: selectedUser.addressComplement ?? '',
      neighborhood: selectedUser.neighborhood ?? '',
      city: selectedUser.city ?? '',
      state: selectedUser.state ?? '',
      zipCode: selectedUser.zipCode ?? '',
      birthDate: selectedUser.birthDate ? selectedUser.birthDate.slice(0, 10) : '',
      profession: selectedUser.profession ?? '',
      birthplace: selectedUser.birthplace ?? '',
      maritalStatus: selectedUser.maritalStatus ?? '',
    })
    setDocumentNotice(null)
    setDocumentDirty(false)
  }, [selectedUser?.id])

  useEffect(() => {
    const relationshipMaritalStatus = formData.relationshipType === 'spouse'
      ? 'Casado'
      : formData.relationshipType === 'partner'
      ? 'Uniao estavel'
      : ''
    setCoBuyerDocumentForm({
      cpf: selectedCoBuyer?.cpf ?? '', rg: selectedCoBuyer?.rg ?? '', address: selectedCoBuyer?.address ?? '',
      addressNumber: selectedCoBuyer?.addressNumber ?? '', addressComplement: selectedCoBuyer?.addressComplement ?? '',
      neighborhood: selectedCoBuyer?.neighborhood ?? '', city: selectedCoBuyer?.city ?? '', state: selectedCoBuyer?.state ?? '', zipCode: selectedCoBuyer?.zipCode ?? '',
      birthDate: selectedCoBuyer?.birthDate?.slice(0, 10) ?? '', profession: selectedCoBuyer?.profession ?? '',
      birthplace: selectedCoBuyer?.birthplace ?? '', maritalStatus: relationshipMaritalStatus || selectedCoBuyer?.maritalStatus || '',
    })
    if (selectedCoBuyer?.id === 'new-sale-participant') {
      setAdditionalDocumentDirty(true)
    } else {
      setAdditionalDocumentDirty(false)
      setAdditionalSaveStatus('idle')
    }
  }, [selectedCoBuyer?.id])

  useEffect(() => {
    if (!selectedCoBuyer) return
    const maritalStatus = formData.relationshipType === 'spouse'
      ? 'Casado'
      : formData.relationshipType === 'partner'
      ? 'Uniao estavel'
      : ''
    if (!maritalStatus) return
    setDocumentForm((current) => current.maritalStatus === maritalStatus ? current : { ...current, maritalStatus })
    setCoBuyerDocumentForm((current) => current.maritalStatus === maritalStatus ? current : { ...current, maritalStatus })
    setPrimaryDocumentDirty(true)
    setAdditionalDocumentDirty(true)
  }, [formData.relationshipType, selectedCoBuyer?.id])

  useEffect(() => {
    setDocumentDirty(primaryDocumentDirty || additionalDocumentDirty)
  }, [primaryDocumentDirty, additionalDocumentDirty])

  useEffect(() => {
    if (!selectedCoBuyer || !sameAddressAsPrimary) return
    setCoBuyerDocumentForm((current) => ({ ...current, address: documentForm.address, addressNumber: documentForm.addressNumber, addressComplement: documentForm.addressComplement, neighborhood: documentForm.neighborhood, city: documentForm.city, state: documentForm.state, zipCode: documentForm.zipCode }))
  }, [selectedCoBuyer?.id, sameAddressAsPrimary, formData.relationshipType, documentForm.address, documentForm.addressNumber, documentForm.addressComplement, documentForm.neighborhood, documentForm.city, documentForm.state, documentForm.zipCode])

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
  const filteredCoBuyerUsers = users.filter((user) => {
    if (user.id === formData.userId) return false
    const query = coBuyerSearch.trim().toLowerCase()
    const digits = coBuyerSearch.replace(/\D/g, '')
    if (!query) return false
    return user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query) || Boolean(digits && user.cpf?.replace(/\D/g, '').includes(digits))
  })

  const filteredLots = lots.filter((lot) => {
    const activeReservation = lot.reservations.find((reservation) => !reservation.cancelledAt && reservation.status !== 'cancelled')
    if (activeReservation && activeReservation.user.id !== formData.userId) return false

    if (!formDevelopmentId || lot.block.development?.id !== formDevelopmentId) return false
    if (!lotSearch) return true
    const searchLower = lotSearch.toLowerCase()
    return (
      lot.identifier.toLowerCase().includes(searchLower) ||
      lot.block.identifier.toLowerCase().includes(searchLower) ||
      `${lot.block.identifier}${lot.identifier}`.toLowerCase().includes(searchLower)
    )
  })
  const lotsByBlock = useMemo(() => {
    const map = new Map<string, { block: Block; lots: Lot[] }>()

    filteredLots.forEach((lot) => {
      const current = map.get(lot.block.id)
      if (current) {
        current.lots.push(lot)
      } else {
        map.set(lot.block.id, { block: lot.block, lots: [lot] })
      }
    })

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        lots: group.lots.sort((a, b) => compareNatural(a.identifier, b.identifier)),
      }))
      .sort((a, b) => compareNatural(a.block.identifier, b.block.identifier))
  }, [filteredLots])

  useEffect(() => {
    if (!selectedLot || sale) return

    if (selectedProposal) {
      setFormData((prev) => ({
        ...prev,
        reservationId: selectedReservation?.id ?? prev.reservationId,
        proposalId: selectedProposal.id,
        salePrice: selectedProposal.salePrice,
        downPayment: selectedProposal.downPayment,
        downPaymentInstallmentCount: selectedProposal.downPaymentInstallmentCount ?? 1,
        downPaymentFirstDueDate: toDateInputValue(selectedProposal.downPaymentFirstDueDate) || formatDateInput(new Date()),
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
      const salePrice = selectedLot.price
      const remainingValue = Math.max(salePrice - downPayment, 0)
      const installmentValue = Math.round(calculateInstallment(
        remainingValue,
        installmentCount,
        commercialSettings?.defaultInterestRate ?? 0,
        commercialSettings?.interestCalculation ?? 'none',
      ) * 100) / 100

      return {
        ...prev,
        proposalId: '',
        salePrice,
        reservationId: selectedReservation?.id ?? prev.reservationId,
        downPayment,
        downPaymentInstallmentCount: 1,
        downPaymentFirstDueDate: formatDateInput(new Date()),
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
    if (field === 'salePrice' || field === 'downPayment' || field === 'downPaymentFirstDueDate' || field === 'installmentCount' || field === 'installmentValue' || field === 'firstDueDate') setPaymentTouched(true)
    setFormData((prev) => {
      const next = {
        ...prev,
        ...(field === 'userId' || field === 'lotId' ? { proposalId: '' } : {}),
        [field]: value,
      }
      if (sale && (field === 'salePrice' || field === 'downPayment' || field === 'installmentCount')) {
        const balance = Math.max(next.salePrice - next.downPayment, 0)
        const interestRate = sale.proposal?.interestRate ?? commercialSettings?.defaultInterestRate ?? 0
        const interestCalculation = sale.proposal?.interestCalculation ?? commercialSettings?.interestCalculation ?? 'none'
        next.installmentValue = Math.round(calculateInstallment(
          balance,
          next.installmentCount,
          interestRate,
          interestCalculation,
        ) * 100) / 100
        next.totalValue = Math.round((next.downPayment + next.installmentValue * next.installmentCount) * 100) / 100
      }
      return next
    })
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const validateStep = (step: number) => {
    const newErrors: Record<string, string> = {}

    if (step === 1 && !formData.userId) newErrors.userId = 'Selecione um cliente'
    if (step === 4 && formData.coBuyerId === formData.userId) newErrors.coBuyerId = 'A pessoa adicional deve ser diferente do comprador principal'
    if (step === 2 && !formData.lotId) newErrors.lotId = 'Selecione um lote'
    if (step === 3) {
      if (proposalNeedsApproval) {
        newErrors.proposal = 'A proposta mais recente precisa ser aprovada antes de gerar a venda.'
      }
      if (formData.salePrice <= 0) newErrors.salePrice = 'Informe o valor da venda'
      if (!Number.isFinite(formData.installmentCount) || formData.installmentCount < 1) newErrors.installmentCount = 'Minimo 1 parcela'
      if (formData.downPayment < 0) newErrors.downPayment = 'Entrada nao pode ser negativa'
      if (formData.downPayment > formData.salePrice) newErrors.downPayment = 'Entrada nao pode ser maior que o valor da venda'
      if (!Number.isFinite(formData.downPaymentInstallmentCount) || formData.downPaymentInstallmentCount < 1 || formData.downPaymentInstallmentCount > maximumDownPaymentInstallments) newErrors.downPaymentInstallmentCount = `A entrada pode ser dividida em ate ${maximumDownPaymentInstallments} vezes`
      if (!sale && !financialTermsLocked && formData.downPayment < minimumDownPayment) {
        newErrors.downPayment = `Entrada minima: ${formatCurrency(minimumDownPayment)}`
      }
      if (!sale && !financialTermsLocked && formData.installmentCount > maximumInstallments) {
        newErrors.installmentCount = `Maximo de ${maximumInstallments} parcelas`
      }
      if (!formData.firstDueDate) newErrors.firstDueDate = 'Informe o primeiro vencimento'
      if (formData.downPayment > 0 && !formData.downPaymentFirstDueDate) newErrors.downPaymentFirstDueDate = 'Informe o primeiro vencimento da entrada'
    }
    if (step === 4) {
      const missing = REQUIRED_DOCUMENT_FIELDS.filter((field) => {
        const value = documentForm[field.key as keyof typeof documentForm]
        return !String(value ?? '').trim()
      })
      if (missing.length > 0) {
        newErrors.documents = `Complete os dados do cliente: ${missing.map((field) => field.label).join(', ')}`
      }
      if (selectedCoBuyer) {
        const requiredCoBuyerFields = { cpf: 'CPF', rg: 'RG', address: 'Endereco', neighborhood: 'Bairro', city: 'Cidade', state: 'UF', zipCode: 'CEP', birthDate: 'Data de nascimento', profession: 'Profissao', birthplace: 'Naturalidade', maritalStatus: 'Estado civil' } as const
        const missingCoBuyer = Object.entries(requiredCoBuyerFields).filter(([key]) => !coBuyerDocumentForm[key as keyof typeof coBuyerDocumentForm].trim()).map(([, label]) => label)
        if (missingCoBuyer.length > 0) newErrors.coBuyerDocuments = `Complete os dados do conjuge: ${missingCoBuyer.join(', ')}`
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const goToStep = async (step: number) => {
    if (step <= currentStep) {
      setCurrentStep(step)
      return
    }
    if (!validateStep(currentStep)) return
    if (currentStep === 4 && documentDirty && !(await saveClientDocuments())) return
    setCurrentStep(step)
  }

  const nextStep = async () => {
    await goToStep(Math.min(currentStep + 1, STEPS.length))
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
    setDocumentDirty(true)
    setPrimaryDocumentDirty(true)
    setPrimarySaveStatus('idle')
    setDocumentNotice(null)
    if (errors.documents) setErrors((current) => ({ ...current, documents: '' }))
  }

  const updateCoBuyerDocumentField = (field: keyof typeof coBuyerDocumentForm, value: string) => {
    setCoBuyerDocumentForm((current) => ({ ...current, [field]: value }))
    setDocumentDirty(true)
    setAdditionalDocumentDirty(true)
    setAdditionalSaveStatus('idle')
    setDocumentNotice(null)
    setErrors((current) => ({ ...current, coBuyerDocuments: '' }))
  }

  const copyPrimaryAddress = () => {
    setCoBuyerDocumentForm((current) => ({
      ...current,
      address: documentForm.address,
      addressNumber: documentForm.addressNumber,
      addressComplement: documentForm.addressComplement,
      neighborhood: documentForm.neighborhood,
      city: documentForm.city,
      state: documentForm.state,
      zipCode: documentForm.zipCode,
    }))
    setDocumentDirty(true)
    setAdditionalDocumentDirty(true)
    setAdditionalSaveStatus('idle')
  }

  const updateRelationshipType = (relationshipType: SaleFormData['relationshipType']) => {
    handleInputChange('relationshipType', relationshipType)
    if (relationshipType === 'spouse') {
      updateDocumentField('maritalStatus', 'Casado')
      updateCoBuyerDocumentField('maritalStatus', 'Casado')
    } else if (relationshipType === 'partner') {
      updateDocumentField('maritalStatus', 'Uniao estavel')
      updateCoBuyerDocumentField('maritalStatus', 'Uniao estavel')
    }
    if (relationshipType !== 'independent' && sameAddressAsPrimary) copyPrimaryAddress()
  }

  async function saveClientDocuments(): Promise<boolean> {
    if (!selectedUser) return false

    const primaryFormatError = getDocumentFormatError(documentForm)
    const additionalFormatError = selectedCoBuyer ? getDocumentFormatError(coBuyerDocumentForm) : ''
    if (primaryFormatError || additionalFormatError) {
      setErrors((current) => ({
        ...current,
        primaryDocumentFormat: primaryFormatError,
        additionalDocumentFormat: additionalFormatError,
      }))
      setActiveDocumentPerson(primaryFormatError ? 'primary' : 'additional')
      return false
    }

    const missing = REQUIRED_DOCUMENT_FIELDS.filter((field) => {
      const value = documentForm[field.key as keyof typeof documentForm]
      return !String(value ?? '').trim()
    })
    if (missing.length > 0) {
      setErrors((current) => ({
        ...current,
        documents: `Complete os dados do cliente: ${missing.map((field) => field.label).join(', ')}`,
      }))
      setActiveDocumentPerson('primary')
      return false
    }
    if (selectedCoBuyer && missingCoBuyerDocumentFields.length > 0) {
      setErrors((current) => ({ ...current, coBuyerDocuments: `Complete os dados da pessoa adicional: ${missingCoBuyerDocumentFields.join(', ')}` }))
      setActiveDocumentPerson('additional')
      return false
    }

    try {
      setDocumentSaving(true)
      setErrors((current) => ({ ...current, documents: '' }))
      setDocumentNotice(null)

      const memberships = selectedUser.memberships?.map((membership) => ({
        developmentId: membership.development.id,
        roleId: membership.roles[0]?.role.id ?? '',
      })) ?? []
      const companyMemberships = selectedUser.companyMemberships?.map((membership) => ({
        companyId: membership.company.id,
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
          companyMemberships,
        }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Erro ao atualizar dados do cliente')
      }

      const updatedUser = await response.json()
      setUsers((current) => current.map((user) => (user.id === updatedUser.id ? { ...user, ...updatedUser } : user)))
      if (selectedCoBuyer) {
        const isNewParticipant = selectedCoBuyer.id === 'new-sale-participant'
        const targetDevelopmentId = formDevelopmentId || selectedLot?.block.development?.id
        const coBuyerResponse = await fetch(isNewParticipant ? '/api/clients' : `/api/clients/${selectedCoBuyer.id}`, {
          method: isNewParticipant ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: selectedCoBuyer.name,
            email: selectedCoBuyer.email,
            ...coBuyerDocumentForm,
            memberships: isNewParticipant && targetDevelopmentId ? [{ developmentId: targetDevelopmentId, roleId: '' }] : selectedCoBuyer.memberships?.map((membership) => ({ developmentId: membership.development.id, roleId: membership.roles[0]?.role.id ?? '' })) ?? [],
            companyMemberships: selectedCoBuyer.companyMemberships?.map((membership) => ({ companyId: membership.company.id, roleId: membership.roles[0]?.role.id ?? '' })) ?? [],
          }),
        })
        if (!coBuyerResponse.ok) {
          const payload = await coBuyerResponse.json()
          throw new Error(payload.error || 'Erro ao atualizar dados do conjuge')
        }
        const updatedCoBuyer = await coBuyerResponse.json()
        setUsers((current) => [updatedCoBuyer, ...current.filter((user) => user.id !== selectedCoBuyer.id && user.id !== updatedCoBuyer.id)])
        if (isNewParticipant) setFormData((current) => ({ ...current, coBuyerId: updatedCoBuyer.id }))
      }
      setDocumentDirty(false)
      setPrimaryDocumentDirty(false)
      setAdditionalDocumentDirty(false)
      setPrimarySaveStatus('saved')
      if (selectedCoBuyer) setAdditionalSaveStatus('saved')
      setDocumentNotice('Dados do cliente salvos.')
      return true
    } catch (error) {
      setErrors((current) => ({
        ...current,
        documents: error instanceof Error ? error.message : 'Erro ao atualizar dados do cliente',
      }))
      return false
    } finally {
      setDocumentSaving(false)
    }
  }

  useEffect(() => {
    if (currentStep !== 4 || !selectedUser || !primaryDocumentDirty) return
    const formatError = getDocumentFormatError(documentForm)
    if (formatError) {
      setPrimarySaveStatus('error')
      setErrors((current) => ({ ...current, primaryDocumentFormat: formatError }))
      return
    }
    setErrors((current) => ({ ...current, primaryDocumentFormat: '' }))
    const timeout = window.setTimeout(async () => {
      setPrimarySaveStatus('saving')
      const memberships = selectedUser.memberships?.map((membership) => ({ developmentId: membership.development.id, roleId: membership.roles[0]?.role.id ?? '' })) ?? []
      const companyMemberships = selectedUser.companyMemberships?.map((membership) => ({ companyId: membership.company.id, roleId: membership.roles[0]?.role.id ?? '' })) ?? []
      try {
        const response = await fetch(`/api/clients/${selectedUser.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: selectedUser.name, email: selectedUser.email, ...documentForm, memberships, companyMemberships }) })
        if (!response.ok) throw new Error((await response.json()).error || 'Erro ao salvar')
        const updatedUser = await response.json()
        setUsers((current) => current.map((user) => user.id === updatedUser.id ? { ...user, ...updatedUser } : user))
        setPrimaryDocumentDirty(false)
        setPrimarySaveStatus('saved')
      } catch {
        setPrimarySaveStatus('error')
        setErrors((current) => ({ ...current, primaryDocumentFormat: 'Nao foi possivel salvar automaticamente.' }))
      }
    }, 800)
    return () => window.clearTimeout(timeout)
  }, [currentStep, documentForm, primaryDocumentDirty, selectedUser])

  useEffect(() => {
    if (currentStep !== 4 || !selectedCoBuyer || !additionalDocumentDirty) return
    const formatError = getDocumentFormatError(coBuyerDocumentForm)
    if (formatError) {
      setAdditionalSaveStatus('error')
      setErrors((current) => ({ ...current, additionalDocumentFormat: formatError }))
      return
    }
    setErrors((current) => ({ ...current, additionalDocumentFormat: '' }))
    const timeout = window.setTimeout(async () => {
      setAdditionalSaveStatus('saving')
      const isNewParticipant = selectedCoBuyer.id === 'new-sale-participant'
      const targetDevelopmentId = formDevelopmentId || selectedLot?.block.development?.id
      const memberships = isNewParticipant && targetDevelopmentId
        ? [{ developmentId: targetDevelopmentId, roleId: '' }]
        : selectedCoBuyer.memberships?.map((membership) => ({ developmentId: membership.development.id, roleId: membership.roles[0]?.role.id ?? '' })) ?? []
      const companyMemberships = selectedCoBuyer.companyMemberships?.map((membership) => ({ companyId: membership.company.id, roleId: membership.roles[0]?.role.id ?? '' })) ?? []
      try {
        const response = await fetch(isNewParticipant ? '/api/clients' : `/api/clients/${selectedCoBuyer.id}`, { method: isNewParticipant ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: selectedCoBuyer.name, email: selectedCoBuyer.email, ...coBuyerDocumentForm, memberships, companyMemberships }) })
        if (!response.ok) throw new Error((await response.json()).error || 'Erro ao salvar')
        const updatedUser = await response.json()
        setUsers((current) => [updatedUser, ...current.filter((user) => user.id !== selectedCoBuyer.id && user.id !== updatedUser.id)])
        if (isNewParticipant) setFormData((current) => ({ ...current, coBuyerId: updatedUser.id }))
        setAdditionalDocumentDirty(false)
        setAdditionalSaveStatus('saved')
      } catch {
        setAdditionalSaveStatus('error')
        setErrors((current) => ({ ...current, additionalDocumentFormat: 'Nao foi possivel salvar automaticamente.' }))
      }
    }, 800)
    return () => window.clearTimeout(timeout)
  }, [additionalDocumentDirty, coBuyerDocumentForm, currentStep, developmentId, selectedCoBuyer, selectedLot?.block.development?.id])

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
        <div className='flex h-full min-h-0 flex-col'>
          <div className='shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-5'>
            <div className='flex items-start justify-between gap-4'>
              <div className='min-w-0'>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-muted'>Fluxo guiado</p>
                <h2 className='mt-1 text-xl font-bold text-foreground sm:mt-2 sm:text-2xl'>{sale ? 'Editar venda' : 'Nova venda'}</h2>
                <p className='mt-2 hidden text-sm leading-6 text-muted sm:block'>Selecione cliente, lote, condicao de pagamento, documentos e revise antes de confirmar.</p>
              </div>
              <button
                type='button'
                onClick={onClose}
                className='shrink-0 rounded-xl border border-border bg-surface-secondary p-2 text-muted transition hover:bg-background hover:text-foreground'
              >
                <svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M6 18L18 6M6 6l12 12' />
                </svg>
              </button>
            </div>

            <div className='mt-3 flex gap-2 overflow-x-auto pb-1 sm:mt-5 sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0'>
              {STEPS.map((step) => (
                <button
                  key={step.id}
                  type='button'
                  onClick={() => void goToStep(step.id)}
                  disabled={documentSaving}
                  className={`min-w-[112px] rounded-xl border px-3 py-2 text-left transition sm:min-w-0 sm:py-3 ${
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
              <div className='mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mt-5'>
                {errors.submit}
              </div>
            )}
          </div>

          <div className='min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6'>
            {currentStep === 1 && (
              <section className='flex flex-col gap-5'>
                <div className='order-0'>
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
                  className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-surface-secondary'
                />
                <div className='max-h-[420px] overflow-y-auto rounded-2xl border border-border bg-surface'>
                  {filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      type='button'
                      onClick={() => handleInputChange('userId', user.id)}
                      className={`flex w-full items-center gap-4 border-b border-border px-4 py-3 text-left transition last:border-b-0 hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-60 ${
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
                  <p className='mt-1 text-sm text-muted'>Escolha o lote pela quadra. Lotes reservados para outro cliente ficam ocultos.</p>
                </div>
                {selectedLot && (
                  <div className='rounded-2xl border border-primary/30 bg-primary/6 p-4'>
                    <p className='text-xs font-semibold uppercase text-primary'>Lote selecionado</p>
                    <div className='mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                      <div>
                        <p className='text-sm font-semibold text-foreground'>Quadra {selectedLot.block.identifier}, Lote {selectedLot.identifier}</p>
                        <p className='mt-1 text-sm text-muted'>{formatArea(selectedLot.totalArea)} · {getLotStatusLabel(selectedLot.status)}</p>
                      </div>
                      <div className='flex flex-wrap items-center gap-2 sm:justify-end'>
                        <span className={`pill ${getLotCardMeta(selectedLot.status).badge}`}>{getLotCardMeta(selectedLot.status).label}</span>
                        <p className='text-sm font-bold text-foreground'>{formatCurrency(selectedLot.price)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {!developmentId && <label className='block'>
                  <span className='mb-2 block text-sm font-semibold'>Loteamento da venda</span>
                  <select value={chosenDevelopmentId} onChange={(event) => { setChosenDevelopmentId(event.target.value); setFormData((previous) => ({ ...previous, lotId: '', reservationId: '', proposalId: '' })) }} className='w-full rounded-xl border border-border bg-background px-4 py-3'>
                    <option value=''>Selecione um loteamento</option>
                    {Array.from(new Map(lots.filter((lot) => lot.block.development).map((lot) => [lot.block.development!.id, lot.block.development!])).values()).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>}
                <div className='rounded-2xl border border-border bg-surface'>
                  <div className='border-b border-border bg-surface-secondary px-4 py-4'>
                    <label className='block'>
                      <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Busca</span>
                      <input
                        type='text'
                        placeholder='Lote, quadra ou empreendimento...'
                        value={lotSearch}
                        onChange={(event) => setLotSearch(event.target.value)}
                        className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                      />
                    </label>
                    <div className='mt-3 flex flex-wrap gap-3'>
                      {Object.entries(lotStatusMeta).map(([status, meta]) => (
                        <div key={status} className='flex items-center gap-2 text-xs font-semibold text-muted'>
                          <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {filteredLots.length === 0 ? (
                    <div className='px-5 py-10 text-center'>
                      <h4 className='text-sm font-semibold text-foreground'>Nenhum lote encontrado</h4>
                      <p className='mt-2 text-sm text-muted'>Ajuste a busca ou selecione outro cliente para ver lotes reservados a ele.</p>
                    </div>
                  ) : (
                    <div className='max-h-[560px] space-y-5 overflow-y-auto p-4'>
                      {lotsByBlock.map(({ block, lots: blockLots }) => (
                        <section key={block.id} className='rounded-2xl border border-border bg-surface-secondary p-4'>
                          <div className='mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
                            <div>
                              <h4 className='text-base font-semibold text-foreground'>Quadra {block.identifier}</h4>
                              <p className='text-sm text-muted'>{block.development?.name ?? 'Sem empreendimento'} · {blockLots.length} lotes</p>
                            </div>
                            <span className='text-sm font-semibold text-muted'>
                              {formatCurrency(blockLots.reduce((sum, lot) => sum + lot.price, 0))}
                            </span>
                          </div>

                          <div className='grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-3'>
                            {blockLots.map((lot) => {
                              const meta = getLotCardMeta(lot.status)
                              const selected = formData.lotId === lot.id
                              return (
                                <button
                                  key={lot.id}
                                  type='button'
                                  onClick={() => handleInputChange('lotId', lot.id)}
                                  className={`min-h-[92px] rounded-xl border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60 ${meta.tile} ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                                >
                                  <span className='block text-xs font-semibold opacity-75'>Lote</span>
                                  <span className='mt-1 block text-lg font-bold'>{lot.identifier}</span>
                                  <span className='mt-1 block truncate text-xs font-semibold'>{formatArea(lot.totalArea)}</span>
                                </button>
                              )
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </div>

                {filteredLots.length > 0 && (
                  <div className='grid gap-3 sm:grid-cols-3'>
                    <div className='rounded-xl border border-border bg-surface-secondary px-4 py-3'>
                      <p className='text-xs font-semibold uppercase text-muted'>Lotes visiveis</p>
                      <p className='mt-1 text-lg font-bold text-foreground'>{filteredLots.length}</p>
                    </div>
                    <div className='rounded-xl border border-border bg-surface-secondary px-4 py-3'>
                      <p className='text-xs font-semibold uppercase text-muted'>Disponiveis</p>
                      <p className='mt-1 text-lg font-bold text-emerald-700'>{filteredLots.filter((lot) => lot.status === 'available').length}</p>
                    </div>
                    <div className='rounded-xl border border-border bg-surface-secondary px-4 py-3'>
                      <p className='text-xs font-semibold uppercase text-muted'>Reservados</p>
                      <p className='mt-1 text-lg font-bold text-amber-700'>{filteredLots.filter((lot) => lot.status === 'reserved').length}</p>
                    </div>
                  </div>
                )}
                {developmentId && lots.length === 0 && (
                  <div className='rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'>
                    Nenhum lote elegivel encontrado no empreendimento selecionado.
                  </div>
                )}
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
                          ? sale
                            ? 'Como administrador, voce pode corrigir os valores desta venda. A proposta aprovada original sera preservada no historico.'
                            : 'Valores definidos conforme a proposta aprovada.'
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
                      {sale
                          ? 'A correcao atualiza a venda e suas parcelas, sem alterar a proposta aprovada nem apagar os valores efetivamente pagos.'
                        : 'Esta venda utiliza as condicoes da proposta aprovada.'}
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
                        <span className='mb-2 block text-sm font-semibold text-foreground'>Valor da venda</span>
                        <NumberTextInput
                          step='0.01'
                          min='0.01'
                          value={formData.salePrice}
                          onValueChange={(value) => handleInputChange('salePrice', value)}
                          disabled={!sale || financialTermsLocked}
                          className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-muted'
                        />
                        {sale && !financialTermsLocked && (
                          <p className='mt-2 text-xs text-muted'>Preco-base do lote: {formatCurrency(selectedLot?.price ?? 0)}</p>
                        )}
                        {errors.salePrice && <p className='mt-2 text-sm font-medium text-red-600'>{errors.salePrice}</p>}
                      </label>
                      <label className='block'>
                        <span className='mb-2 block text-sm font-semibold text-foreground'>Valor de entrada</span>
                        <NumberTextInput
                          step='0.01'
                          min='0'
                          max={formData.salePrice || 0}
                          value={formData.downPayment}
                          onValueChange={(value) => handleInputChange('downPayment', value)}
                          disabled={financialTermsLocked}
                          className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-muted'
                        />
                        {!financialTermsLocked && (
                          <p className='mt-2 text-xs font-semibold text-muted'>Minimo: {formatCurrency(minimumDownPayment)}</p>
                        )}
                        {errors.downPayment && <p className='mt-2 text-sm font-medium text-red-600'>{errors.downPayment}</p>}
                      </label>
                      <label className='block'>
                        <span className='mb-2 block text-sm font-semibold text-foreground'>Numero de parcelas</span>
                        <NumberTextInput
                          min='1'
                          max={maximumInstallments}
                          value={formData.installmentCount}
                          onValueChange={(value) => handleInputChange('installmentCount', Math.trunc(value))}
                          disabled={financialTermsLocked}
                          className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-muted'
                        />
                        {!financialTermsLocked && (
                          <p className='mt-2 text-xs font-semibold text-muted'>Maximo: {maximumInstallments} parcelas</p>
                        )}
                        {errors.installmentCount && <p className='mt-2 text-sm font-medium text-red-600'>{errors.installmentCount}</p>}
                      </label>
                      {allowsDownPaymentInstallments && (
                        <label className='block'>
                          <span className='mb-2 block text-sm font-semibold text-foreground'>Parcelas da entrada</span>
                          <NumberTextInput min={1} max={maximumDownPaymentInstallments} value={formData.downPaymentInstallmentCount} onValueChange={(value) => handleInputChange('downPaymentInstallmentCount', Math.trunc(value))} disabled={financialTermsLocked} className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-muted' />
                          <p className='mt-2 text-xs text-muted'>Cada parcela: {formatCurrency(formData.downPayment / Math.max(formData.downPaymentInstallmentCount, 1))}</p>
                          {errors.downPaymentInstallmentCount && <p className='mt-2 text-sm font-medium text-red-600'>{errors.downPaymentInstallmentCount}</p>}
                        </label>
                      )}
                      {formData.downPayment > 0 && (
                        <label className='block'>
                          <span className='mb-2 block text-sm font-semibold text-foreground'>Primeiro vencimento da entrada</span>
                          <input
                            type='date'
                            value={formData.downPaymentFirstDueDate}
                            onChange={(event) => handleInputChange('downPaymentFirstDueDate', event.target.value)}
                            disabled={financialTermsLocked}
                            className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-muted'
                          />
                          {errors.downPaymentFirstDueDate && <p className='mt-2 text-sm font-medium text-red-600'>{errors.downPaymentFirstDueDate}</p>}
                        </label>
                      )}
                      <label className='block'>
                        <span className='mb-2 block text-sm font-semibold text-foreground'>Primeira parcela do saldo</span>
                        <input
                          type='date'
                          min={minimumBalanceDueDate || undefined}
                          value={formData.firstDueDate}
                          onChange={(event) => handleInputChange('firstDueDate', event.target.value)}
                          className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                        />
                        {minimumBalanceDueDate && (
                          <p className='mt-2 text-xs text-muted'>As parcelas do saldo comecam depois da ultima parcela da entrada.</p>
                        )}
                        {sale && (
                          <p className='mt-2 text-xs text-muted'>A nova data reorganiza mensalmente apenas as parcelas que ainda nao foram pagas.</p>
                        )}
                        {errors.firstDueDate && <p className='mt-2 text-sm font-medium text-red-600'>{errors.firstDueDate}</p>}
                      </label>
                    </div>
                    <label className='mt-5 flex items-center gap-3 text-sm font-semibold text-foreground'>
                      <input
                        id='annual-adjustment'
                        type='checkbox'
                        checked={formData.annualAdjustment}
                        onChange={(event) => handleInputChange('annualAdjustment', event.target.checked)}
                        disabled={financialTermsLocked}
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
                      <span className='font-semibold text-foreground'>{formatCurrency(formData.salePrice)}</span>
                    </div>
                    <div className='flex justify-between gap-3'>
                      <span className='text-muted'>Entrada</span>
                      <span className='font-semibold text-foreground'>{formatCurrency(formData.downPayment)}</span>
                    </div>
                    <div className='flex justify-between gap-3'>
                      <span className='text-muted'>Saldo</span>
                      <span className='font-semibold text-foreground'>{formatCurrency(formData.salePrice - formData.downPayment)}</span>
                    </div>
                    <div className='flex justify-between gap-3'>
                      <span className='text-muted'>Primeira parcela do saldo</span>
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
              <section className='flex flex-col gap-5'>
                <div className='order-0'>
                  <h3 className='text-base font-semibold text-foreground'>Documentos</h3>
                  <p className='mt-1 text-sm text-muted'>Complete os dados contratuais sem sair do fluxo de venda.</p>
                </div>
                {!showAdditionalPerson && !selectedCoBuyer && (
                  <button type='button' onClick={() => { setShowAdditionalPerson(true); setActiveDocumentPerson('additional') }} className='order-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-5 py-4 text-sm font-semibold text-primary transition hover:bg-primary/10'>+ Adicionar outra pessoa ao contrato</button>
                )}
                {(showAdditionalPerson || selectedCoBuyer) && <div className='order-2 rounded-2xl border border-border bg-surface-secondary p-5'>
                  <div className='flex items-start gap-3'>
                    <button type='button' disabled={!selectedCoBuyer} onClick={() => setActiveDocumentPerson((current) => current === 'additional' ? 'none' : 'additional')} className='flex min-w-0 flex-1 items-center justify-between gap-3 text-left disabled:cursor-default'>
                      <div className='min-w-0'><p className='text-xs font-semibold uppercase tracking-wide text-primary'>Pessoa adicional · Opcional</p><h4 className='mt-1 truncate text-base font-semibold text-foreground'>{selectedCoBuyer?.name ?? 'Selecione ou cadastre uma pessoa'}</h4><p className='mt-1 truncate text-xs text-muted'>{selectedCoBuyer?.email ?? 'Ela também constará como compradora no contrato.'}</p>{selectedCoBuyer && getAutosaveLabel(additionalSaveStatus) && <p className={`mt-1 text-xs font-semibold ${additionalSaveStatus === 'error' ? 'text-red-600' : additionalSaveStatus === 'saved' ? 'text-emerald-700' : 'text-muted'}`}>{getAutosaveLabel(additionalSaveStatus)}</p>}</div>
                      {selectedCoBuyer && <div className='flex shrink-0 items-center gap-3'><span className={`rounded-full px-3 py-1 text-xs font-semibold ${missingCoBuyerDocumentFields.length ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{missingCoBuyerDocumentFields.length ? 'Dados incompletos' : 'Dados completos ✓'}</span><span className='text-lg text-muted'>{activeDocumentPerson === 'additional' ? '−' : '+'}</span></div>}
                    </button>
                    <button type='button' onClick={() => { handleInputChange('coBuyerId', ''); setCoBuyerSearch(''); setActiveDocumentPerson('primary'); setShowAdditionalPerson(false) }} className='shrink-0 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground'>{selectedCoBuyer ? 'Remover' : 'Cancelar'}</button>
                  </div>
                  {!selectedCoBuyer && <input value={coBuyerSearch} onChange={(event) => setCoBuyerSearch(event.target.value)} placeholder='Buscar por nome, email ou CPF...' className='mt-4 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary' />}
                  {coBuyerSearch.trim() && !selectedCoBuyer && <div className='mt-2 max-h-52 overflow-y-auto rounded-xl border border-border bg-surface'>{filteredCoBuyerUsers.map((user) => <button key={user.id} type='button' onClick={() => { handleInputChange('coBuyerId', user.id); setCoBuyerSearch(user.name); setActiveDocumentPerson('additional'); updateRelationshipType('spouse') }} className='block w-full border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-surface-secondary'><span className='block text-sm font-semibold text-foreground'>{user.name}</span><span className='block text-xs text-muted'>{user.email} · CPF: {user.cpf || 'Nao informado'}</span></button>)}</div>}
                  {!selectedCoBuyer && <button type='button' onClick={() => setShowQuickCoBuyerForm((current) => !current)} className='mt-3 text-sm font-semibold text-primary'>{showQuickCoBuyerForm ? 'Cancelar cadastro' : '+ Cadastrar nova pessoa'}</button>}
                  {showQuickCoBuyerForm && !selectedCoBuyer && <div className='mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]'><input value={quickCoBuyer.name} onChange={(event) => setQuickCoBuyer((current) => ({ ...current, name: event.target.value }))} placeholder='Nome completo' className='rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary' /><input type='email' value={quickCoBuyer.email} onChange={(event) => setQuickCoBuyer((current) => ({ ...current, email: event.target.value }))} placeholder='Email' className='rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary' /><button type='button' onClick={createQuickCoBuyer} disabled={quickCoBuyerSaving} className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60'>{quickCoBuyerSaving ? 'Criando...' : 'Criar e selecionar'}</button></div>}
                  {selectedCoBuyer && <label className='mt-4 block'><span className='mb-2 block text-sm font-semibold text-foreground'>Vinculo com o comprador principal</span><select value={formData.relationshipType} onChange={(event) => updateRelationshipType(event.target.value as SaleFormData['relationshipType'])} className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary'><option value='spouse'>Conjuge</option><option value='partner'>Companheiro(a) / uniao estavel</option><option value='independent'>Segundo comprador independente</option></select></label>}
                  {errors.coBuyerId && <p className='mt-2 text-sm font-medium text-red-600'>{errors.coBuyerId}</p>}
                  {selectedCoBuyer && activeDocumentPerson === 'additional' && (
                    <div className='mt-5 border-t border-border pt-5'>
                      <h5 className='text-sm font-semibold text-foreground'>Dados pessoais e endereco</h5>
                      <p className='mt-1 text-xs text-muted'>Complete os dados desta pessoa para o contrato.</p>
                      {errors.additionalDocumentFormat && <div className='mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>{errors.additionalDocumentFormat}</div>}
                      {errors.coBuyerDocuments && <div className='mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>{errors.coBuyerDocuments}</div>}
                      <div className='mt-4 grid gap-4 md:grid-cols-2'>
                        <label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>CPF</span><input value={coBuyerDocumentForm.cpf} onChange={(event) => updateCoBuyerDocumentField('cpf', event.target.value)} className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary' /></label>
                        <label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>RG</span><input value={coBuyerDocumentForm.rg} onChange={(event) => updateCoBuyerDocumentField('rg', event.target.value)} className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary' /></label>
                        <label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>Data de nascimento</span><input type='date' value={coBuyerDocumentForm.birthDate} onChange={(event) => updateCoBuyerDocumentField('birthDate', event.target.value)} className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary' /></label>
                        <label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>Profissao</span><input value={coBuyerDocumentForm.profession} onChange={(event) => updateCoBuyerDocumentField('profession', event.target.value)} className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary' /></label>
                        <label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>Naturalidade</span><input value={coBuyerDocumentForm.birthplace} onChange={(event) => updateCoBuyerDocumentField('birthplace', event.target.value)} className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary' /></label>
                        <label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>Estado civil</span><select value={coBuyerDocumentForm.maritalStatus} onChange={(event) => updateCoBuyerDocumentField('maritalStatus', event.target.value)} className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary'>{MARITAL_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                        <label className='flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground md:col-span-2'><input type='checkbox' checked={sameAddressAsPrimary} onChange={(event) => { setSameAddressAsPrimary(event.target.checked); if (event.target.checked) copyPrimaryAddress() }} className='h-4 w-4 rounded border-border text-primary' />Usar o mesmo endereco do comprador principal</label>
                        {sameAddressAsPrimary ? <div className='rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted md:col-span-2'><span className='block text-xs font-semibold uppercase text-primary'>Endereco copiado</span><span className='mt-1 block'>{[documentForm.address, documentForm.addressNumber, documentForm.addressComplement, documentForm.neighborhood, documentForm.city, documentForm.state, documentForm.zipCode].filter(Boolean).join(', ') || 'Preencha o endereco do comprador principal.'}</span></div> : <><label className='block md:col-span-2'><span className='mb-2 block text-sm font-semibold text-foreground'>Endereco / logradouro</span><textarea rows={2} value={coBuyerDocumentForm.address} onChange={(event) => updateCoBuyerDocumentField('address', event.target.value)} className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary' /></label><label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>Numero</span><input value={coBuyerDocumentForm.addressNumber} onChange={(event) => updateCoBuyerDocumentField('addressNumber', event.target.value)} className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary' /></label><label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>Complemento</span><input value={coBuyerDocumentForm.addressComplement} onChange={(event) => updateCoBuyerDocumentField('addressComplement', event.target.value)} className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary' /></label><label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>Bairro</span><input value={coBuyerDocumentForm.neighborhood} onChange={(event) => updateCoBuyerDocumentField('neighborhood', event.target.value)} className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary' /></label><label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>Cidade</span><input value={coBuyerDocumentForm.city} onChange={(event) => updateCoBuyerDocumentField('city', event.target.value)} className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary' /></label><label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>UF</span><input value={coBuyerDocumentForm.state} onChange={(event) => updateCoBuyerDocumentField('state', event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))} className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary' /></label><label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>CEP</span><input value={coBuyerDocumentForm.zipCode} onChange={(event) => updateCoBuyerDocumentField('zipCode', event.target.value.replace(/\D/g, '').slice(0, 8))} className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary' /></label></>}
                      </div>
                    </div>
                  )}
                </div>}
                {documentNotice && (
                  <div className='order-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'>
                    {documentNotice}
                  </div>
                )}
                {errors.documents && (
                  <div className='order-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
                    {errors.documents}
                  </div>
                )}
                <div className='order-1 rounded-2xl border border-border bg-surface-secondary p-5'>
                <button type='button' onClick={() => setActiveDocumentPerson((current) => current === 'primary' ? 'none' : 'primary')} className='flex w-full items-center justify-between gap-3 text-left'>
                  <div><p className='text-xs font-semibold uppercase tracking-wide text-primary'>Comprador principal</p><p className='mt-1 text-base font-semibold text-foreground'>{selectedUser?.name}</p><p className='text-sm text-muted'>{selectedUser?.email}</p>{getAutosaveLabel(primarySaveStatus) && <p className={`mt-1 text-xs font-semibold ${primarySaveStatus === 'error' ? 'text-red-600' : primarySaveStatus === 'saved' ? 'text-emerald-700' : 'text-muted'}`}>{getAutosaveLabel(primarySaveStatus)}</p>}</div>
                  <div className='flex items-center gap-3'><span className={`rounded-full px-3 py-1 text-xs font-semibold ${missingDocumentFields.length ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{missingDocumentFields.length ? 'Dados incompletos' : 'Dados completos ✓'}</span><span className='text-lg text-muted'>{activeDocumentPerson === 'primary' ? '−' : '+'}</span></div>
                </button>
                {activeDocumentPerson === 'primary' && <>
                <div className='my-5 border-t border-border pt-5'><h5 className='text-sm font-semibold text-foreground'>Dados pessoais e endereco</h5><p className='mt-1 text-xs text-muted'>Complete os dados desta pessoa para o contrato.</p></div>
                {errors.primaryDocumentFormat && <div className='mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>{errors.primaryDocumentFormat}</div>}
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
                    <span className='mb-2 block text-sm font-semibold text-foreground'>Endereco / logradouro</span>
                    <textarea
                      rows={2}
                      value={documentForm.address}
                      onChange={(event) => updateDocumentField('address', event.target.value)}
                      className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                    />
                  </label>
                  <label className='block'>
                    <span className='mb-2 block text-sm font-semibold text-foreground'>Numero</span>
                    <input
                      value={documentForm.addressNumber}
                      onChange={(event) => updateDocumentField('addressNumber', event.target.value)}
                      className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                    />
                  </label>
                  <label className='block'>
                    <span className='mb-2 block text-sm font-semibold text-foreground'>Complemento</span>
                    <input
                      value={documentForm.addressComplement}
                      onChange={(event) => updateDocumentField('addressComplement', event.target.value)}
                      className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                    />
                  </label>
                  <label className='block'>
                    <span className='mb-2 block text-sm font-semibold text-foreground'>Bairro</span>
                    <input
                      value={documentForm.neighborhood}
                      onChange={(event) => updateDocumentField('neighborhood', event.target.value)}
                      className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                    />
                  </label>
                  <label className='block'>
                    <span className='mb-2 block text-sm font-semibold text-foreground'>Cidade</span>
                    <input
                      value={documentForm.city}
                      onChange={(event) => updateDocumentField('city', event.target.value)}
                      className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                    />
                  </label>
                  <label className='block'>
                    <span className='mb-2 block text-sm font-semibold text-foreground'>UF</span>
                    <input
                      value={documentForm.state}
                      onChange={(event) => updateDocumentField('state', event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
                      maxLength={2}
                      className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                    />
                  </label>
                  <label className='block'>
                    <span className='mb-2 block text-sm font-semibold text-foreground'>CEP</span>
                    <input
                      value={documentForm.zipCode}
                      onChange={(event) => updateDocumentField('zipCode', event.target.value.replace(/\D/g, '').slice(0, 8))}
                      inputMode='numeric'
                      className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                    />
                  </label>
                </div>
                </>}
                </div>
                <div className='order-3 flex flex-col gap-3 md:flex-row md:items-center'>
                  {!documentDirty && missingDocumentFields.length === 0 && (
                    <span className='pill bg-emerald-50 text-emerald-700'>Dados completos</span>
                  )}
                  {documentDirty && (
                    <span className='text-sm text-muted'>As alteracoes serao salvas ao continuar.</span>
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
                      {selectedCoBuyer && (
                        <div className='mt-3 border-t border-border pt-3'>
                          <p className='text-xs font-semibold uppercase text-muted'>Segundo comprador</p>
                          <p className='font-semibold text-foreground'>{selectedCoBuyer.name}</p>
                          <p>CPF: {selectedCoBuyer.cpf || 'Nao informado'}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                    <h4 className='text-sm font-semibold text-foreground'>Lote</h4>
                    <div className='mt-3 text-sm leading-6 text-muted'>
                      <p className='font-semibold text-foreground'>Quadra {selectedLot?.block.identifier}, Lote {selectedLot?.identifier}</p>
                      <p>{formatArea(selectedLot?.totalArea ?? 0)}</p>
                      <p>{formatCurrency(formData.salePrice)}</p>
                    </div>
                  </div>
                  <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                    <h4 className='text-sm font-semibold text-foreground'>Pagamento</h4>
                    <div className='mt-3 text-sm leading-6 text-muted'>
                      <p>Entrada: <span className='font-semibold text-foreground'>{formatCurrency(formData.downPayment)}</span>{formData.downPaymentInstallmentCount > 1 ? ` em ${formData.downPaymentInstallmentCount}x` : ''}</p>
                      {formData.downPayment > 0 && <p>Primeira entrada: <span className='font-semibold text-foreground'>{formatDate(formData.downPaymentFirstDueDate)}</span></p>}
                      <p>{formData.installmentCount}x de <span className='font-semibold text-foreground'>{formatCurrency(formData.installmentValue)}</span></p>
                      <p>Primeira parcela do saldo: <span className='font-semibold text-foreground'>{formatDate(formData.firstDueDate)}</span></p>
                      <p>Total: <span className='font-semibold text-foreground'>{formatCurrency(formData.totalValue)}</span></p>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>

          <div className='shrink-0 border-t border-border px-4 py-3 sm:px-6 sm:py-5'>
            <div className='grid grid-cols-3 gap-2 md:flex md:items-center md:justify-between md:gap-3'>
              <button
                type='button'
                onClick={prevStep}
                disabled={currentStep === 1}
                className='rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold text-foreground transition hover:bg-surface-secondary disabled:opacity-50 sm:px-4 sm:py-3'
              >
                Anterior
              </button>

              <div className='col-span-2 grid grid-cols-2 gap-2 md:flex md:gap-3'>
                <button
                  type='button'
                  onClick={onClose}
                  disabled={loading}
                  className='rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold text-foreground transition hover:bg-surface-secondary disabled:opacity-60 sm:px-4 sm:py-3'
                >
                  Cancelar
                </button>
                {currentStep < STEPS.length ? (
                  <button
                    type='button'
                    onClick={() => void nextStep()}
                    disabled={documentSaving}
                    className='rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-strong sm:px-4 sm:py-3'
                  >
                    {documentSaving
                      ? 'Salvando...'
                      : currentStep === 4 && (documentDirty || missingDocumentFields.length > 0)
                      ? 'Salvar e continuar'
                      : 'Proximo'}
                  </button>
                ) : (
                  <button
                    type='button'
                    onClick={handleSubmit}
                    disabled={loading || proposalNeedsApproval}
                    className='rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-60 sm:px-4 sm:py-3'
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
