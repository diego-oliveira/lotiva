'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'

type ViewMode = 'map' | 'list'
type SortField = 'identifier' | 'block' | 'totalArea' | 'price' | 'status'

interface Development {
  id: string
  name: string
  settings?: DevelopmentSettings | null
}

interface DevelopmentSettings {
  reservationValidityDays: number
  defaultInterestRate: number
  interestCalculation: 'none' | 'simple' | 'compound'
  correctionIndex: 'none' | 'ipca' | 'incc' | 'igpm' | 'fixed'
  correctionFrequency: 'monthly' | 'annual'
  minDownPaymentPercentage: number
  maxInstallments: number
  paymentMethods: string
  allowCustomTerms: boolean
}

interface Block {
  id: string
  identifier: string
  development?: Development | null
}

interface Person {
  id: string
  name: string
  email: string
}

interface LotReservation {
  id: string
  proposal: string
  status: string
  expiresAt?: string | null
  cancelledAt?: string | null
  createdAt: string
  updatedAt: string
  user: Person
  sale?: { id: string } | null
  canManage?: boolean
}

interface LotSale {
  id: string
  installmentCount: number
  installmentValue: number
  downPayment: number
  annualAdjustment: boolean
  totalValue: number
  createdAt: string
  updatedAt: string
  user: Person
  contract?: { id: string; contractNumber: string; emailSent: boolean } | null
}

interface LotProposal {
  id: string
  status: string
  salePrice: number
  downPayment: number
  installmentCount: number
  installmentValue: number
  balance: number
  totalValue: number
  interestRate: number
  interestCalculation: DevelopmentSettings['interestCalculation']
  correctionIndex: DevelopmentSettings['correctionIndex']
  correctionFrequency: DevelopmentSettings['correctionFrequency']
  firstDueDate?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  user: Person
}

interface LotEvent {
  id: string
  type: string
  title: string
  description?: string | null
  notes?: string | null
  createdAt: string
  user?: Person | null
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
  reservations: LotReservation[]
  proposals: LotProposal[]
  sale?: LotSale | null
  events: LotEvent[]
  canReleaseHold?: boolean
  saleEligibility?: {
    userId: string
    canConvert: boolean
    requiresApproval: boolean
    proposalId?: string | null
  } | null
}

const statusMeta: Record<string, { label: string; tile: string; badge: string; dot: string }> = {
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
  sold: {
    label: 'Vendido',
    tile: 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100',
    badge: 'bg-red-50 text-red-700',
    dot: 'bg-red-500',
  },
}

function getStatusMeta(status: string) {
  return statusMeta[status] ?? {
    label: status || 'Sem status',
    tile: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
    badge: 'bg-slate-100 text-slate-700',
    dot: 'bg-slate-400',
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatArea(value: number) {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m2`
}

function formatMeasurement(value: number) {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m`
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR')
}

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10)
}

function getDefaultDueDate() {
  const date = new Date()
  date.setMonth(date.getMonth() + 1)
  return formatDateInput(date)
}

function getDefaultExpirationDate(days = 7) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return formatDateInput(date)
}

function compareNatural(a: string, b: string) {
  return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })
}

function getActiveReservation(lot: Lot) {
  return lot.reservations.find((reservation) => !reservation.sale && reservation.status !== 'cancelled' && !reservation.cancelledAt) ?? null
}

function getLotContact(lot: Lot) {
  if (lot.sale) return { label: 'Comprador', person: lot.sale.user }
  const reservation = getActiveReservation(lot)
  if (reservation) return { label: 'Cliente da reserva', person: reservation.user }
  return null
}

function isReservationExpired(reservation: LotReservation | null) {
  return Boolean(reservation?.expiresAt && new Date(reservation.expiresAt) < new Date())
}

function getEffectiveLotStatus(lot: Lot) {
  if (lot.sale || lot.status === 'sold') return 'sold'
  if (getActiveReservation(lot)) return 'reserved'
  return lot.status
}

function calculateInstallment(balance: number, installmentCount: number, monthlyInterestRate: number, interestCalculation: string) {
  if (installmentCount <= 0) return 0
  if (balance <= 0) return 0

  const monthlyRate = monthlyInterestRate / 100
  if (monthlyRate <= 0 || interestCalculation === 'none') return balance / installmentCount
  if (interestCalculation === 'simple') return (balance * (1 + monthlyRate * installmentCount)) / installmentCount

  const factor = Math.pow(1 + monthlyRate, installmentCount)
  return (balance * monthlyRate * factor) / (factor - 1)
}

function LotsContent() {
  const searchParams = useSearchParams()
  const developmentFilter = searchParams.get('developmentId') ?? ''
  const [lots, setLots] = useState<Lot[]>([])
  const [clients, setClients] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reservationError, setReservationError] = useState<string | null>(null)
  const [reservationSaving, setReservationSaving] = useState(false)
  const [eventSaving, setEventSaving] = useState(false)
  const [eventError, setEventError] = useState<string | null>(null)
  const [eventNote, setEventNote] = useState('')
  const [showReservationForm, setShowReservationForm] = useState(false)
  const [reservationForm, setReservationForm] = useState({
    userId: '',
    proposal: '',
    expiresAt: getDefaultExpirationDate(),
  })
  const [showSimulator, setShowSimulator] = useState(false)
  const [proposalNotice, setProposalNotice] = useState<string | null>(null)
  const [proposalError, setProposalError] = useState<string | null>(null)
  const [proposalSaving, setProposalSaving] = useState(false)
  const [proposalOutcome, setProposalOutcome] = useState<{ id: string; status: string; clientName: string } | null>(null)
  const [proposalForm, setProposalForm] = useState({
    userId: '',
    notes: '',
  })
  const [clientSearch, setClientSearch] = useState('')
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)
  const [showQuickClientForm, setShowQuickClientForm] = useState(false)
  const [quickClient, setQuickClient] = useState({
    name: '',
    email: '',
  })
  const [quickClientSaving, setQuickClientSaving] = useState(false)
  const [simulatorForm, setSimulatorForm] = useState({
    salePrice: 0,
    downPayment: 0,
    installmentCount: 120,
    interestRate: 0,
    interestCalculation: 'none' as DevelopmentSettings['interestCalculation'],
    correctionIndex: 'none' as DevelopmentSettings['correctionIndex'],
    correctionFrequency: 'monthly' as DevelopmentSettings['correctionFrequency'],
    firstDueDate: getDefaultDueDate(),
  })
  const [viewMode, setViewMode] = useState<ViewMode>('map')
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null)
  const [clientFilter, setClientFilter] = useState('')
  const [blockFilter, setBlockFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<SortField>('block')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [canManageUsers, setCanManageUsers] = useState(false)

  async function fetchLots() {
    try {
      setLoading(true)
      const response = await fetch('/api/lots', { cache: 'no-store' })
      if (!response.ok) throw new Error('Nao foi possivel carregar os lotes')
      setLots(await response.json())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar lotes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchLots()
    fetch('/api/me/permissions', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => setCanManageUsers(Boolean(payload?.permissions?.manageUsers)))
      .catch(() => setCanManageUsers(false))
  }, [])

  useEffect(() => {
    const userId = searchParams.get('userId')
    const status = searchParams.get('status')
    setClientFilter(userId ?? '')
    setStatusFilter(status ?? '')
    setSelectedLotId(null)
  }, [searchParams])

  useEffect(() => {
    setBlockFilter('')
    setSelectedLotId(null)
  }, [developmentFilter])

  async function fetchClients() {
    const response = await fetch('/api/clients?scope=operational', { cache: 'no-store' })
    if (!response.ok) throw new Error('Nao foi possivel carregar clientes')
    setClients(await response.json())
  }

  async function saveLotEventNote() {
    if (!selectedLot || !eventNote.trim()) return

    try {
      setEventSaving(true)
      setEventError(null)
      const response = await fetch(`/api/lots/${selectedLot.id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: eventNote }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Nao foi possivel registrar a observacao')
      }

      setEventNote('')
      await fetchLots()
    } catch (err) {
      setEventError(err instanceof Error ? err.message : 'Nao foi possivel registrar a observacao')
    } finally {
      setEventSaving(false)
    }
  }

  const blocks = useMemo(() => {
    const map = new Map<string, Block>()
    lots.forEach((lot) => {
      if (!developmentFilter || lot.block.development?.id === developmentFilter) {
        map.set(lot.block.id, lot.block)
      }
    })
    return Array.from(map.values()).sort((a, b) => compareNatural(a.identifier, b.identifier))
  }, [lots, developmentFilter])

  const statuses = useMemo(() => {
    const values = [...new Set(lots.map((lot) => getEffectiveLotStatus(lot)).filter(Boolean))]
    return values.sort((a, b) => compareNatural(getStatusMeta(a).label, getStatusMeta(b).label))
  }, [lots])

  const filteredLots = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const digits = searchTerm.replace(/\D/g, '')

    return lots
      .filter((lot) => !developmentFilter || lot.block.development?.id === developmentFilter)
      .filter((lot) => (
        !clientFilter ||
        lot.sale?.user.id === clientFilter ||
        lot.reservations.some((reservation) => reservation.user.id === clientFilter) ||
        lot.proposals.some((proposal) => proposal.user.id === clientFilter)
      ))
      .filter((lot) => !blockFilter || lot.blockId === blockFilter)
      .filter((lot) => !statusFilter || getEffectiveLotStatus(lot) === statusFilter)
      .filter((lot) => {
        if (!query) return true
        return (
          lot.identifier.toLowerCase().includes(query) ||
          lot.block.identifier.toLowerCase().includes(query) ||
          lot.block.development?.name.toLowerCase().includes(query) ||
          Boolean(digits && lot.identifier.replace(/\D/g, '').includes(digits))
        )
      })
      .sort((a, b) => {
        let result = 0

        if (sortBy === 'identifier') result = compareNatural(a.identifier, b.identifier)
        if (sortBy === 'block') {
          result = compareNatural(a.block.identifier, b.block.identifier)
          if (result === 0) result = compareNatural(a.identifier, b.identifier)
        }
        if (sortBy === 'totalArea') result = a.totalArea - b.totalArea
        if (sortBy === 'price') result = a.price - b.price
        if (sortBy === 'status') result = compareNatural(getStatusMeta(getEffectiveLotStatus(a)).label, getStatusMeta(getEffectiveLotStatus(b)).label)

        return sortDirection === 'asc' ? result : -result
      })
  }, [lots, developmentFilter, clientFilter, blockFilter, statusFilter, searchTerm, sortBy, sortDirection])

  const hasActiveLotFilters = Boolean(clientFilter || blockFilter || statusFilter || searchTerm)

  const lotsByBlock = useMemo(() => {
    const map = new Map<string, { block: Block; lots: Lot[] }>()

    filteredLots.forEach((lot) => {
      const current = map.get(lot.blockId)
      if (current) {
        current.lots.push(lot)
      } else {
        map.set(lot.blockId, { block: lot.block, lots: [lot] })
      }
    })

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        lots: group.lots.sort((a, b) => compareNatural(a.identifier, b.identifier)),
      }))
      .sort((a, b) => compareNatural(a.block.identifier, b.block.identifier))
  }, [filteredLots])

  const selectedLot = useMemo(
    () => filteredLots.find((lot) => lot.id === selectedLotId) ?? lots.find((lot) => lot.id === selectedLotId) ?? null,
    [filteredLots, lots, selectedLotId],
  )
  const selectedLotStatus = selectedLot ? getEffectiveLotStatus(selectedLot) : null
  const selectedDevelopmentSettings = selectedLot?.block.development?.settings ?? null
  const selectedLotReservation = selectedLot ? getActiveReservation(selectedLot) : null
  const selectedReservationProposal = selectedLot?.proposals.find(
    (proposal) => proposal.user.id === selectedLotReservation?.user.id,
  ) ?? null
  const reservationCanConvert = selectedLot?.saleEligibility?.canConvert === true
  const reservationProposalId = selectedLot?.saleEligibility?.proposalId ?? selectedReservationProposal?.id ?? null

  const simulation = useMemo(() => {
    const balance = Math.max(simulatorForm.salePrice - simulatorForm.downPayment, 0)
    const installmentValue = calculateInstallment(
      balance,
      simulatorForm.installmentCount,
      simulatorForm.interestRate,
      simulatorForm.interestCalculation,
    )
    const financedTotal = installmentValue * simulatorForm.installmentCount
    const totalContracted = simulatorForm.downPayment + financedTotal

    return {
      balance,
      installmentValue,
      financedTotal,
      totalContracted,
      interestCost: Math.max(totalContracted - simulatorForm.salePrice, 0),
    }
  }, [simulatorForm])

  const simulationIsValid = useMemo(
    () =>
      simulatorForm.salePrice > 0 &&
      simulatorForm.downPayment >= 0 &&
      simulatorForm.downPayment <= simulatorForm.salePrice &&
      simulatorForm.installmentCount > 0 &&
      simulation.installmentValue > 0,
    [simulatorForm, simulation.installmentValue],
  )

  const commercialRules = useMemo(() => {
    const minDownPaymentPercentage = selectedDevelopmentSettings?.minDownPaymentPercentage ?? 0
    const minDownPayment = (simulatorForm.salePrice * minDownPaymentPercentage) / 100
    const maxInstallments = selectedDevelopmentSettings?.maxInstallments ?? 240
    const allowCustomTerms = selectedDevelopmentSettings?.allowCustomTerms ?? true
    const belowMinimumDownPayment = simulatorForm.downPayment < minDownPayment
    const aboveMaxInstallments = simulatorForm.installmentCount > maxInstallments
    const belowBasePrice = Boolean(selectedLot && simulatorForm.salePrice < selectedLot.price)
    const interestRateChanged = simulatorForm.interestRate !== (selectedDevelopmentSettings?.defaultInterestRate ?? 0)
    const interestCalculationChanged = simulatorForm.interestCalculation !== (selectedDevelopmentSettings?.interestCalculation ?? 'none')
    const correctionIndexChanged = simulatorForm.correctionIndex !== (selectedDevelopmentSettings?.correctionIndex ?? 'none')
    const correctionFrequencyChanged = simulatorForm.correctionFrequency !== (selectedDevelopmentSettings?.correctionFrequency ?? 'monthly')
    const hasException = (
      belowMinimumDownPayment ||
      aboveMaxInstallments ||
      belowBasePrice ||
      interestRateChanged ||
      interestCalculationChanged ||
      correctionIndexChanged ||
      correctionFrequencyChanged
    )

    return {
      minDownPayment,
      minDownPaymentPercentage,
      maxInstallments,
      allowCustomTerms,
      belowMinimumDownPayment,
      aboveMaxInstallments,
      belowBasePrice,
      interestRateChanged,
      interestCalculationChanged,
      correctionIndexChanged,
      correctionFrequencyChanged,
      hasException,
      canSave: !hasException || allowCustomTerms,
    }
  }, [selectedDevelopmentSettings, selectedLot, simulatorForm])

  const proposalCanBeSaved = simulationIsValid && commercialRules.canSave && Boolean(proposalForm.userId) && !proposalSaving

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase()
    const digits = clientSearch.replace(/\D/g, '')

    if (!query && !digits) return []
    return clients.filter((client) => (
      client.name.toLowerCase().includes(query) ||
      client.email.toLowerCase().includes(query) ||
      Boolean(digits && client.email.replace(/\D/g, '').includes(digits))
    ))
  }, [clients, clientSearch])

  const selectedProposalClient = useMemo(
    () => clients.find((client) => client.id === proposalForm.userId) ?? null,
    [clients, proposalForm.userId],
  )

  const stats = useMemo(() => {
    const sold = filteredLots.filter((lot) => getEffectiveLotStatus(lot) === 'sold').length
    const total = filteredLots.length

    return {
      total,
      available: filteredLots.filter((lot) => getEffectiveLotStatus(lot) === 'available').length,
      reserved: filteredLots.filter((lot) => getEffectiveLotStatus(lot) === 'reserved').length,
      sold,
      soldPercentage: total > 0 ? sold / total : 0,
    }
  }, [filteredLots])

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDirection('asc')
    }
  }

  const clearFilters = () => {
    setClientFilter('')
    setBlockFilter('')
    setStatusFilter('')
    setSearchTerm('')
    setSelectedLotId(null)
  }

  const selectLot = (lotId: string) => {
    setSelectedLotId((current) => (current === lotId ? null : lotId))
    setShowReservationForm(false)
    setShowSimulator(false)
    setReservationError(null)
    setProposalError(null)
    setProposalNotice(null)
  }

  const openSimulator = async () => {
    if (!selectedLot) return

    try {
      setProposalError(null)
      if (clients.length === 0) await fetchClients()

      const settings = selectedLot.block.development?.settings
      const salePrice = selectedLot.price
      const minDownPaymentPercentage = settings?.minDownPaymentPercentage ?? 10
      const maxInstallments = settings?.maxInstallments ?? 120
      const activeReservation = getActiveReservation(selectedLot)

      setSimulatorForm({
        salePrice,
        downPayment: Math.round((salePrice * minDownPaymentPercentage) / 100),
        installmentCount: maxInstallments,
        interestRate: settings?.defaultInterestRate ?? 0,
        interestCalculation: settings?.interestCalculation ?? 'none',
        correctionIndex: settings?.correctionIndex ?? 'none',
        correctionFrequency: settings?.correctionFrequency ?? 'monthly',
        firstDueDate: getDefaultDueDate(),
      })
      setProposalForm({
        userId: activeReservation?.user.id ?? '',
        notes: activeReservation?.proposal ?? '',
      })
      setClientSearch('')
      setClientDropdownOpen(false)
      setShowQuickClientForm(false)
      setQuickClient({ name: '', email: '' })
      setShowReservationForm(false)
      setShowSimulator(true)
      setProposalNotice(null)
    } catch (err) {
      setProposalError(err instanceof Error ? err.message : 'Erro ao carregar clientes')
    }
  }

  const openReservationForm = async () => {
    if (!selectedLot) return

    try {
      setReservationError(null)
      if (clients.length === 0) await fetchClients()
      const activeReservation = getActiveReservation(selectedLot)
      setReservationForm({
        userId: activeReservation?.user.id ?? '',
        proposal: activeReservation?.proposal ?? '',
        expiresAt: activeReservation?.expiresAt ? formatDateInput(new Date(activeReservation.expiresAt)) : getDefaultExpirationDate(),
      })
      setShowReservationForm(true)
    } catch (err) {
      setReservationError(err instanceof Error ? err.message : 'Erro ao carregar clientes')
    }
  }

  const saveReservation = async () => {
    if (!selectedLot) return
    if (!reservationForm.userId) {
      setReservationError('Selecione um cliente para reservar o lote.')
      return
    }

    try {
      setReservationSaving(true)
      setReservationError(null)
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotId: selectedLot.id,
          userId: reservationForm.userId,
          proposal: reservationForm.proposal,
          expiresAt: reservationForm.expiresAt,
          status: 'active',
        }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Erro ao reservar lote')
      }

      await fetchLots()
      setShowReservationForm(false)
    } catch (err) {
      setReservationError(err instanceof Error ? err.message : 'Erro ao reservar lote')
    } finally {
      setReservationSaving(false)
    }
  }

  const cancelReservation = async () => {
    if (!selectedLot) return
    const activeReservation = getActiveReservation(selectedLot)
    if (!activeReservation) return

    try {
      setReservationSaving(true)
      setReservationError(null)
      const response = await fetch(`/api/reservations/${activeReservation.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Erro ao cancelar reserva')
      }

      await fetchLots()
      setShowReservationForm(false)
    } catch (err) {
      setReservationError(err instanceof Error ? err.message : 'Erro ao cancelar reserva')
    } finally {
      setReservationSaving(false)
    }
  }

  const updateLotStatus = async (status: 'available' | 'on_hold') => {
    if (!selectedLot) return

    try {
      setReservationSaving(true)
      setReservationError(null)
      const response = await fetch(`/api/lots/${selectedLot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: selectedLot.identifier,
          blockId: selectedLot.blockId,
          front: selectedLot.front,
          back: selectedLot.back,
          leftSide: selectedLot.leftSide,
          rightSide: selectedLot.rightSide,
          totalArea: selectedLot.totalArea,
          price: selectedLot.price,
          status,
        }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Nao foi possivel atualizar o status do lote')
      }

      await fetchLots()
    } catch (err) {
      setReservationError(err instanceof Error ? err.message : 'Nao foi possivel atualizar o status do lote')
    } finally {
      setReservationSaving(false)
    }
  }

  const saveProposal = async () => {
    if (!selectedLot) return
    if (!proposalForm.userId) {
      setProposalError('Selecione um cliente para salvar a proposta.')
      return
    }
    if (!commercialRules.canSave) {
      setProposalError('A proposta esta fora das regras comerciais do empreendimento.')
      return
    }

    const activeReservation = getActiveReservation(selectedLot)
    const reservationId = activeReservation?.user.id === proposalForm.userId ? activeReservation.id : null

    try {
      setProposalSaving(true)
      setProposalError(null)
      setProposalNotice(null)

      const response = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotId: selectedLot.id,
          userId: proposalForm.userId,
          reservationId,
          salePrice: simulatorForm.salePrice,
          downPayment: simulatorForm.downPayment,
          installmentCount: simulatorForm.installmentCount,
          installmentValue: simulation.installmentValue,
          balance: simulation.balance,
          totalValue: simulation.totalContracted,
          interestRate: simulatorForm.interestRate,
          interestCalculation: simulatorForm.interestCalculation,
          correctionIndex: simulatorForm.correctionIndex,
          correctionFrequency: simulatorForm.correctionFrequency,
          firstDueDate: simulatorForm.firstDueDate,
          notes: proposalForm.notes,
        }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Erro ao salvar proposta')
      }

      const proposal = await response.json()
      await fetchLots()
      setProposalOutcome({
        id: proposal.id,
        status: proposal.status,
        clientName: proposal.user?.name ?? selectedProposalClient?.name ?? 'cliente',
      })
      setShowSimulator(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setProposalError(err instanceof Error ? err.message : 'Erro ao salvar proposta')
    } finally {
      setProposalSaving(false)
    }
  }

  const createQuickClient = async () => {
    if (!selectedLot?.block.development?.id) {
      setProposalError('Selecione um lote vinculado a um empreendimento para criar cliente.')
      return
    }
    if (!quickClient.name.trim()) {
      setProposalError('Informe o nome do cliente.')
      return
    }
    if (!quickClient.email.trim()) {
      setProposalError('Informe o email do cliente.')
      return
    }

    try {
      setQuickClientSaving(true)
      setProposalError(null)
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: quickClient.name,
          email: quickClient.email,
          memberships: [{ developmentId: selectedLot.block.development.id, roleId: '' }],
        }),
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Erro ao criar cliente')
      }

      const client = await response.json()
      setClients((current) => [client, ...current.filter((item) => item.id !== client.id)])
      setProposalForm((current) => ({ ...current, userId: client.id }))
      setClientSearch(client.name)
      setClientDropdownOpen(false)
      setShowQuickClientForm(false)
      setQuickClient({ name: '', email: '' })
      setProposalNotice('Cliente criado e selecionado para a proposta.')
    } catch (err) {
      setProposalError(err instanceof Error ? err.message : 'Erro ao criar cliente')
    } finally {
      setQuickClientSaving(false)
    }
  }

  if (loading) {
    return (
      <div className='space-y-6'>
        <div className='h-24 animate-pulse rounded-2xl bg-surface-secondary' />
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
        <p className='font-semibold'>Erro ao carregar lotes</p>
        <p className='mt-1 text-sm'>{error}</p>
        <button onClick={fetchLots} className='mt-4 rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-800 transition hover:bg-red-200'>
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='page-title'>Lotes</h1>
          <p className='page-subtitle'>Consulte disponibilidade no mapa operacional ou compare os lotes pela lista.</p>
        </div>
        <div className='flex flex-wrap gap-3'>
          <div className='inline-flex overflow-hidden rounded-xl border border-border bg-surface p-1'>
            <button
              onClick={() => setViewMode('map')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${viewMode === 'map' ? 'bg-primary text-white' : 'text-muted hover:bg-surface-secondary hover:text-foreground'}`}
            >
              Mapa
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${viewMode === 'list' ? 'bg-primary text-white' : 'text-muted hover:bg-surface-secondary hover:text-foreground'}`}
            >
              Lista
            </button>
          </div>
        </div>
      </div>

      {proposalOutcome && (
        <div className={`rounded-2xl border px-5 py-4 ${
          proposalOutcome.status === 'approved'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-amber-200 bg-amber-50 text-amber-800'
        }`}>
          <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
            <div>
              <p className='font-semibold'>
                {proposalOutcome.status === 'approved'
                  ? `Proposta de ${proposalOutcome.clientName} aprovada automaticamente.`
                  : `Proposta de ${proposalOutcome.clientName} enviada para aprovacao.`}
              </p>
              <p className='mt-1 text-sm'>
                {proposalOutcome.status === 'approved'
                  ? 'As condicoes seguem as regras do empreendimento e a venda ja pode continuar.'
                  : 'O lote permanece reservado enquanto um administrador revisa as condicoes excepcionais.'}
              </p>
            </div>
            <div className='flex shrink-0 gap-2'>
              <Link
                href={`/proposals?developmentId=${selectedLot?.block.development?.id ?? developmentFilter}&proposalId=${proposalOutcome.id}`}
                className='rounded-xl bg-surface px-4 py-3 text-sm font-semibold text-foreground shadow-sm'
              >
                Ver proposta
              </Link>
              {proposalOutcome.status === 'approved' && selectedLot && (
                <Link
                  href={`/sales?developmentId=${selectedLot.block.development?.id ?? developmentFilter}&lotId=${selectedLot.id}&userId=${proposalForm.userId}&proposalId=${proposalOutcome.id}`}
                  className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white'
                >
                  Continuar venda
                </Link>
              )}
              <button
                type='button'
                onClick={() => setProposalOutcome(null)}
                className='rounded-xl border border-current/20 px-4 py-3 text-sm font-semibold'
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-5'>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Lotes vendidos</p>
          <p className='metric-value text-primary'>
            {new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(stats.soldPercentage)}
          </p>
        </div>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Lotes totais</p>
          <p className='metric-value'>{stats.total}</p>
        </div>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Vendidos</p>
          <p className='metric-value text-red-700'>{stats.sold}</p>
        </div>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Reservados</p>
          <p className='metric-value text-amber-700'>{stats.reserved}</p>
        </div>
        <div className='metric-card px-5 py-4'>
          <p className='metric-label'>Disponiveis</p>
          <p className='metric-value text-emerald-700'>{stats.available}</p>
        </div>
      </section>

      <section className='panel overflow-hidden'>
        <div className='panel-header px-6 py-5'>
          <div className='grid gap-4 lg:grid-cols-[minmax(220px,1.3fr)_minmax(160px,0.8fr)_minmax(160px,0.8fr)_auto] lg:items-end'>
            <label className='block'>
              <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Busca</span>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder='Lote, quadra ou empreendimento...'
                className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
              />
            </label>
            <label className='block'>
              <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Quadra</span>
              <select
                value={blockFilter}
                onChange={(event) => { setBlockFilter(event.target.value); setSelectedLotId(null) }}
                className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
              >
                <option value=''>Todas</option>
                {blocks.map((block) => (
                  <option key={block.id} value={block.id}>Quadra {block.identifier}</option>
                ))}
              </select>
            </label>
            <label className='block'>
              <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => { setStatusFilter(event.target.value); setSelectedLotId(null) }}
                className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
              >
                <option value=''>Todos</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>{getStatusMeta(status).label}</option>
                ))}
              </select>
            </label>
            <button onClick={clearFilters} className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'>
              Limpar
            </button>
          </div>
        </div>

        <div className='min-h-[620px]'>
          <div className='min-w-0'>
            {filteredLots.length === 0 ? (
              <div className='flex min-h-[420px] flex-col items-center justify-center px-6 py-12 text-center'>
                <div className='flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-secondary text-muted'>
                  <svg className='h-7 w-7' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M4 6h16v12H4zM8 6v12M16 6v12M4 10h16M4 14h16' />
                  </svg>
                </div>
                <h2 className='mt-4 text-base font-semibold text-foreground'>Nenhum lote encontrado</h2>
                <p className='mt-2 max-w-md text-sm leading-6 text-muted'>
                  {hasActiveLotFilters
                    ? 'Ajuste ou limpe os filtros para visualizar o mapa e a lista de lotes.'
                    : 'Crie um empreendimento com quadras e lotes para iniciar a operacao comercial.'}
                </p>
                {hasActiveLotFilters ? (
                  <button onClick={clearFilters} className='mt-6 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'>
                    Limpar filtros
                  </button>
                ) : (
                  <Link href='/developments' className='mt-6 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong'>
                    Criar empreendimento
                  </Link>
                )}
              </div>
            ) : viewMode === 'map' ? (
              <div className='space-y-6 p-6'>
                <div className='flex flex-wrap gap-3'>
                  {Object.entries(statusMeta).map(([status, meta]) => (
                    <div key={status} className='flex items-center gap-2 text-xs font-semibold text-muted'>
                      <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </div>
                  ))}
                </div>

                <div className='space-y-6'>
                  {lotsByBlock.map(({ block, lots: blockLots }) => (
                    <section key={block.id} className='rounded-2xl border border-border bg-surface-secondary p-4'>
                      <div className='mb-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between'>
                        <div>
                          <h2 className='text-base font-semibold text-foreground'>Quadra {block.identifier}</h2>
                          <p className='text-sm text-muted'>{block.development?.name ?? 'Sem empreendimento'} · {blockLots.length} lotes</p>
                        </div>
                        <span className='text-sm font-semibold text-muted'>{formatCurrency(blockLots.reduce((sum, lot) => sum + lot.price, 0))}</span>
                      </div>
                      <div className='grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-3'>
                        {blockLots.map((lot) => {
                          const meta = getStatusMeta(getEffectiveLotStatus(lot))
                          const selected = selectedLotId === lot.id
                          return (
                            <button
                              key={lot.id}
                              type='button'
                              onClick={() => selectLot(lot.id)}
                              className={`min-h-[86px] rounded-xl border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-primary ${meta.tile} ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
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
              </div>
            ) : (
              <div className='overflow-x-auto'>
                <table className='min-w-full divide-y divide-border'>
                  <thead className='bg-surface-secondary'>
                    <tr>
                      {[
                        ['identifier', 'Lote'],
                        ['block', 'Quadra'],
                        ['totalArea', 'Area'],
                        ['price', 'Valor'],
                        ['status', 'Status'],
                      ].map(([field, label]) => (
                        <th key={field} className='table-head px-6 py-4 text-left'>
                          <button onClick={() => toggleSort(field as SortField)} className='inline-flex items-center gap-1 transition hover:text-foreground'>
                            {label}
                            {sortBy === field && <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-border bg-surface'>
                    {filteredLots.map((lot) => {
                      const meta = getStatusMeta(getEffectiveLotStatus(lot))
                      const selected = selectedLotId === lot.id
                      return (
                        <tr
                          key={lot.id}
                          onClick={() => selectLot(lot.id)}
                          className={`cursor-pointer transition hover:bg-surface-secondary/70 ${selected ? 'bg-primary/6' : ''}`}
                        >
                          <td className='px-6 py-4'>
                            <div className='flex items-center gap-3'>
                              <span className={`h-3 w-3 rounded-full ${meta.dot}`} />
                              <div>
                                <p className='text-sm font-semibold text-foreground'>Lote {lot.identifier}</p>
                                <p className='text-xs text-muted'>{lot.block.development?.name ?? 'Sem empreendimento'}</p>
                              </div>
                            </div>
                          </td>
                          <td className='px-6 py-4 text-sm font-medium text-foreground'>Quadra {lot.block.identifier}</td>
                          <td className='px-6 py-4 text-sm text-muted'>
                            <p className='font-semibold text-foreground'>{formatArea(lot.totalArea)}</p>
                            <p className='text-xs'>Frente {formatMeasurement(lot.front)} · Fundo {formatMeasurement(lot.back)}</p>
                          </td>
                          <td className='px-6 py-4 text-sm text-muted'>
                            <p className='font-semibold text-foreground'>{formatCurrency(lot.price)}</p>
                            <p className='text-xs'>{formatCurrency(lot.price / lot.totalArea)}/m2</p>
                          </td>
                          <td className='px-6 py-4'>
                            <span className={`pill ${meta.badge}`}>{meta.label}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selectedLot && (
            <>
              <button
                type='button'
                aria-label='Fechar detalhes do lote'
                className='fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px] lg:left-[290px]'
                onClick={() => setSelectedLotId(null)}
              />
              <aside className='fixed inset-y-0 right-0 z-50 w-full max-w-3xl overflow-y-auto border-l border-border bg-surface px-6 py-6 shadow-2xl'>
              <div className='space-y-6'>
                <div className='flex items-start justify-between gap-4'>
                  <div>
                    <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Lote selecionado</p>
                    <h2 className='mt-2 text-2xl font-bold text-foreground'>Quadra {selectedLot.block.identifier}, Lote {selectedLot.identifier}</h2>
                    <p className='mt-1 text-sm text-muted'>{selectedLot.block.development?.name ?? 'Sem empreendimento'}</p>
                  </div>
                  <button
                    type='button'
                    onClick={() => setSelectedLotId(null)}
                    className='rounded-xl border border-border bg-surface-secondary p-2 text-muted transition hover:bg-background hover:text-foreground'
                    aria-label='Fechar'
                  >
                    <svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M6 18L18 6M6 6l12 12' />
                    </svg>
                  </button>
                </div>

                <div className='flex flex-wrap items-center gap-2'>
                  <span className={`pill ${getStatusMeta(selectedLotStatus ?? selectedLot.status).badge}`}>{getStatusMeta(selectedLotStatus ?? selectedLot.status).label}</span>
                  {selectedLot.sale?.contract && (
                    <span className='pill bg-emerald-50 text-emerald-700'>Contrato {selectedLot.sale.contract.contractNumber}</span>
                  )}
                </div>

                <div className='grid grid-cols-2 gap-3'>
                  <div className='rounded-xl border border-border bg-surface-secondary p-4'>
                    <p className='text-xs font-semibold uppercase text-muted'>Valor</p>
                    <p className='mt-2 text-lg font-bold text-foreground'>{formatCurrency(selectedLot.price)}</p>
                  </div>
                  <div className='rounded-xl border border-border bg-surface-secondary p-4'>
                    <p className='text-xs font-semibold uppercase text-muted'>Area</p>
                    <p className='mt-2 text-lg font-bold text-foreground'>{formatArea(selectedLot.totalArea)}</p>
                  </div>
                </div>

                {getLotContact(selectedLot) && (
                  <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                    <p className='text-xs font-semibold uppercase text-muted'>{getLotContact(selectedLot)?.label}</p>
                    <p className='mt-2 text-base font-semibold text-foreground'>{getLotContact(selectedLot)?.person.name}</p>
                    <p className='mt-1 text-sm text-muted'>{getLotContact(selectedLot)?.person.email}</p>
                    {canManageUsers && (
                      <Link href='/clients' className='mt-4 inline-flex rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-background'>
                        Ver clientes
                      </Link>
                    )}
                  </div>
                )}

                {selectedLot.sale && (
                  <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                    <h3 className='text-sm font-semibold text-foreground'>Resumo da venda</h3>
                    <dl className='mt-4 grid grid-cols-2 gap-3 text-sm'>
                      <div>
                        <dt className='text-muted'>Total</dt>
                        <dd className='font-semibold text-foreground'>{formatCurrency(selectedLot.sale.totalValue)}</dd>
                      </div>
                      <div>
                        <dt className='text-muted'>Entrada</dt>
                        <dd className='font-semibold text-foreground'>{formatCurrency(selectedLot.sale.downPayment)}</dd>
                      </div>
                      <div>
                        <dt className='text-muted'>Parcelas</dt>
                        <dd className='font-semibold text-foreground'>{selectedLot.sale.installmentCount}x</dd>
                      </div>
                      <div>
                        <dt className='text-muted'>Valor/parcela</dt>
                        <dd className='font-semibold text-foreground'>{formatCurrency(selectedLot.sale.installmentValue)}</dd>
                      </div>
                    </dl>
                  </div>
                )}

                {getActiveReservation(selectedLot) && !selectedLot.sale && (
                  <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                    <div className='flex items-start justify-between gap-3'>
                      <div>
                        <h3 className='text-sm font-semibold text-foreground'>Reserva ativa</h3>
                        <p className='mt-1 text-xs font-semibold text-muted'>Criada em {formatDate(getActiveReservation(selectedLot)!.createdAt)}</p>
                      </div>
                      {isReservationExpired(getActiveReservation(selectedLot)) ? (
                        <span className='pill bg-red-50 text-red-700'>Vencida</span>
                      ) : (
                        <span className='pill bg-amber-50 text-amber-700'>Ativa</span>
                      )}
                    </div>
                    <p className='mt-2 text-sm leading-6 text-muted'>{getActiveReservation(selectedLot)?.proposal || 'Sem proposta registrada.'}</p>
                    {getActiveReservation(selectedLot)?.expiresAt && (
                      <p className='mt-3 text-sm font-semibold text-foreground'>Valida ate {formatDate(getActiveReservation(selectedLot)!.expiresAt!)}</p>
                    )}
                  </div>
                )}

                {selectedLot.proposals.length > 0 && (
                  <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                    <div className='flex items-start justify-between gap-3'>
                      <div>
                        <h3 className='text-sm font-semibold text-foreground'>Propostas</h3>
                        <p className='mt-1 text-xs font-semibold text-muted'>{selectedLot.proposals.length} registrada(s)</p>
                      </div>
                      <span className='pill bg-surface text-muted'>{selectedLot.proposals[0].status}</span>
                    </div>
                    <div className='mt-4 space-y-3'>
                      {selectedLot.proposals.slice(0, 3).map((proposal) => (
                        <div key={proposal.id} className='rounded-xl border border-border bg-surface px-4 py-3'>
                          <div className='flex items-start justify-between gap-3'>
                            <div>
                              <p className='text-sm font-semibold text-foreground'>{proposal.user.name}</p>
                              <p className='mt-1 text-xs text-muted'>
                                Entrada {formatCurrency(proposal.downPayment)} · {proposal.installmentCount}x de {formatCurrency(proposal.installmentValue)}
                              </p>
                            </div>
                            <p className='text-sm font-bold text-foreground'>{formatCurrency(proposal.totalValue)}</p>
                          </div>
                          <p className='mt-2 text-xs text-muted'>Salva em {formatDate(proposal.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                  <h3 className='text-sm font-semibold text-foreground'>Medidas</h3>
                  <dl className='mt-4 grid grid-cols-2 gap-3 text-sm'>
                    <div>
                      <dt className='text-muted'>Frente</dt>
                      <dd className='font-semibold text-foreground'>{formatMeasurement(selectedLot.front)}</dd>
                    </div>
                    <div>
                      <dt className='text-muted'>Fundo</dt>
                      <dd className='font-semibold text-foreground'>{formatMeasurement(selectedLot.back)}</dd>
                    </div>
                    <div>
                      <dt className='text-muted'>Lateral esquerda</dt>
                      <dd className='font-semibold text-foreground'>{formatMeasurement(selectedLot.leftSide)}</dd>
                    </div>
                    <div>
                      <dt className='text-muted'>Lateral direita</dt>
                      <dd className='font-semibold text-foreground'>{formatMeasurement(selectedLot.rightSide)}</dd>
                    </div>
                  </dl>
                </div>

                <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                  <h3 className='text-sm font-semibold text-foreground'>Acoes</h3>
                  {reservationError && (
                    <div className='mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
                      {reservationError}
                    </div>
                  )}
                  <div className='mt-4 space-y-3'>
                    {selectedLotStatus === 'available' && (
                      <>
                        <button onClick={openSimulator} className='w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong'>
                          Simular venda
                        </button>
                        <button onClick={openReservationForm} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-background'>
                          Reservar lote
                        </button>
                        <button onClick={() => updateLotStatus('on_hold')} disabled={reservationSaving} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-background disabled:opacity-60'>
                          Bloquear lote
                        </button>
                      </>
                    )}

                    {selectedLotStatus === 'reserved' && (
                      <>
                        {reservationCanConvert ? (
                          <Link
                            href={`/sales?developmentId=${selectedLot.block.development?.id ?? developmentFilter}&lotId=${selectedLot.id}${selectedLotReservation ? `&userId=${selectedLotReservation.user.id}&reservationId=${selectedLotReservation.id}` : ''}${reservationProposalId ? `&proposalId=${reservationProposalId}` : ''}`}
                            className='block w-full rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-primary-strong'
                          >
                            Converter em venda
                          </Link>
                        ) : (
                          <>
                            <button
                              type='button'
                              disabled
                              title='A proposta precisa ser aprovada antes de converter o lote em venda'
                              className='w-full cursor-not-allowed rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white opacity-45'
                            >
                              Converter em venda
                            </button>
                            <p className='text-sm font-semibold text-amber-700'>
                              A proposta precisa ser aprovada antes da conversao.
                            </p>
                          </>
                        )}
                        <button onClick={openSimulator} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-background'>
                          Simular nova condicao
                        </button>
                        {selectedLotReservation?.canManage ? (
                          <button onClick={cancelReservation} disabled={reservationSaving} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-background disabled:opacity-60'>
                            Liberar lote
                          </button>
                        ) : (
                          <p className='rounded-xl border border-border bg-background px-4 py-3 text-center text-sm text-muted'>
                            Somente o responsavel pela reserva ou um administrador pode liberar este lote.
                          </p>
                        )}
                      </>
                    )}

                    {selectedLotStatus === 'on_hold' && (
                      <>
                        {selectedLot.canReleaseHold ? (
                          <button onClick={() => updateLotStatus('available')} disabled={reservationSaving} className='w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-60'>
                            Liberar lote
                          </button>
                        ) : (
                          <p className='rounded-xl border border-border bg-background px-4 py-3 text-center text-sm text-muted'>
                            Somente quem bloqueou o lote ou um administrador pode libera-lo.
                          </p>
                        )}
                        <button onClick={openSimulator} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-background'>
                          Simular venda
                        </button>
                      </>
                    )}

                    {selectedLotStatus === 'sold' && (
                      <>
                        <Link href={`/sales?developmentId=${selectedLot.block.development?.id ?? developmentFilter}`} className='block w-full rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-primary-strong'>
                          Ver venda
                        </Link>
                        {selectedLot.sale?.contract && (
                          <Link href={`/api/contracts/${selectedLot.sale.id}/pdf`} className='block w-full rounded-xl border border-border bg-surface px-4 py-3 text-center text-sm font-semibold text-foreground transition hover:bg-background'>
                            Baixar contrato
                          </Link>
                        )}
                      </>
                    )}

                  </div>

                  {showReservationForm && (
                    <div className='mt-5 rounded-2xl border border-border bg-surface p-4'>
                      <h4 className='text-sm font-semibold text-foreground'>Nova reserva</h4>
                      <div className='mt-4 space-y-4'>
                        <label className='block'>
                          <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Cliente</span>
                          <select
                            value={reservationForm.userId}
                            onChange={(event) => setReservationForm((current) => ({ ...current, userId: event.target.value }))}
                            className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                          >
                            <option value=''>Selecione...</option>
                            {clients.map((client) => (
                              <option key={client.id} value={client.id}>{client.name} · {client.email}</option>
                            ))}
                          </select>
                        </label>

                        <label className='block'>
                          <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Validade</span>
                          <input
                            type='date'
                            value={reservationForm.expiresAt}
                            onChange={(event) => setReservationForm((current) => ({ ...current, expiresAt: event.target.value }))}
                            className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                          />
                        </label>

                        <label className='block'>
                          <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Proposta/observacao</span>
                          <textarea
                            rows={3}
                            value={reservationForm.proposal}
                            onChange={(event) => setReservationForm((current) => ({ ...current, proposal: event.target.value }))}
                            className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                            placeholder='Condição conversada com o cliente'
                          />
                        </label>

                        <div className='flex gap-3'>
                          <button
                            onClick={saveReservation}
                            disabled={reservationSaving}
                            className='flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-60'
                          >
                            {reservationSaving ? 'Reservando...' : 'Confirmar reserva'}
                          </button>
                          <button
                            onClick={() => setShowReservationForm(false)}
                            disabled={reservationSaving}
                            className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-background disabled:opacity-60'
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                  <div className='flex items-start justify-between gap-3'>
                    <div>
                      <h3 className='text-sm font-semibold text-foreground'>Historico do lote</h3>
                      <p className='mt-1 text-xs text-muted'>{selectedLot.events.length} evento(s) registrados</p>
                    </div>
                    <span className='pill bg-surface text-muted'>Timeline</span>
                  </div>

                  <div className='mt-4 rounded-xl border border-border bg-surface p-4'>
                    <label className='block'>
                      <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Observacao manual</span>
                      <textarea
                        rows={3}
                        value={eventNote}
                        onChange={(event) => setEventNote(event.target.value)}
                        className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                        placeholder='Registre uma decisao, contato ou detalhe importante'
                      />
                    </label>
                    {eventError && <p className='mt-2 text-sm font-medium text-red-600'>{eventError}</p>}
                    <button
                      onClick={saveLotEventNote}
                      disabled={eventSaving || !eventNote.trim()}
                      className='mt-3 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-60'
                    >
                      {eventSaving ? 'Registrando...' : 'Registrar observacao'}
                    </button>
                  </div>

                  <div className='mt-4 space-y-3'>
                    {selectedLot.events.length === 0 ? (
                      <div className='rounded-xl border border-dashed border-border bg-surface px-4 py-5 text-center text-sm text-muted'>
                        Nenhum evento registrado para este lote.
                      </div>
                    ) : (
                      selectedLot.events.slice(0, 8).map((event) => (
                        <div key={event.id} className='rounded-xl border border-border bg-surface px-4 py-3'>
                          <div className='flex items-start justify-between gap-3'>
                            <div>
                              <p className='text-sm font-semibold text-foreground'>{event.title}</p>
                              {event.description && <p className='mt-1 text-sm leading-5 text-muted'>{event.description}</p>}
                              {event.notes && <p className='mt-2 rounded-lg bg-surface-secondary px-3 py-2 text-sm leading-5 text-foreground'>{event.notes}</p>}
                            </div>
                            <p className='shrink-0 text-xs text-muted'>{formatDate(event.createdAt)}</p>
                          </div>
                          <p className='mt-2 text-xs text-muted'>{event.user ? `Por ${event.user.name}` : 'Evento do sistema'}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              </aside>
            </>
          )}
        </div>
      </section>

      {showSimulator && selectedLot && (
        <>
          <button
            type='button'
            aria-label='Fechar simulador financeiro'
            className='fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px] lg:left-[290px]'
            onClick={() => setShowSimulator(false)}
          />
          <aside className='fixed inset-y-0 right-0 z-50 w-full max-w-5xl border-l border-border bg-surface shadow-2xl'>
            <div className='flex h-full flex-col'>
              <div className='border-b border-border px-6 py-5'>
                <div className='flex items-start justify-between gap-4'>
                  <div>
                    <p className='text-xs font-semibold uppercase tracking-[0.2em] text-muted'>Simulador financeiro</p>
                    <h2 className='mt-2 text-2xl font-bold text-foreground'>Quadra {selectedLot.block.identifier}, Lote {selectedLot.identifier}</h2>
                    <p className='mt-2 text-sm leading-6 text-muted'>
                      {selectedLot.block.development?.name ?? 'Sem empreendimento'} · {formatArea(selectedLot.totalArea)} · valor base {formatCurrency(selectedLot.price)}
                    </p>
                  </div>
                  <button
                    type='button'
                    onClick={() => setShowSimulator(false)}
                    className='rounded-xl border border-border bg-surface-secondary p-2 text-muted transition hover:bg-background hover:text-foreground'
                  >
                    <svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M6 18L18 6M6 6l12 12' />
                    </svg>
                  </button>
                </div>
                {(proposalNotice || proposalError) && (
                  <div
                    className={`mt-5 rounded-xl border px-4 py-3 text-sm font-medium ${
                      proposalNotice
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-red-200 bg-red-50 text-red-700'
                    }`}
                  >
                    {proposalNotice || proposalError}
                  </div>
                )}
              </div>

              <div className='flex-1 overflow-y-auto px-6 py-6'>
                <div className='grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]'>
                  <div className='space-y-6'>
                    <section className='rounded-2xl border border-border bg-surface-secondary p-5'>
                      <h3 className='text-base font-semibold text-foreground'>Condicao comercial</h3>
                      <div className='mt-5 grid gap-4 md:grid-cols-2'>
                        <div className='md:col-span-2'>
                          <div className='relative'>
                            <label className='block'>
                              <span className='mb-2 block text-sm font-semibold text-foreground'>Cliente</span>
                              <input
                                type='text'
                                value={clientSearch}
                                onFocus={() => {
                                  if (clientSearch.trim()) setClientDropdownOpen(true)
                                }}
                                onChange={(event) => {
                                  setClientSearch(event.target.value)
                                  setClientDropdownOpen(Boolean(event.target.value.trim()))
                                  setShowQuickClientForm(false)
                                }}
                                placeholder='Buscar por nome ou email...'
                                className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                              />
                            </label>

                            {selectedProposalClient && (
                              <div className='mt-3 flex items-start justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/6 px-4 py-3'>
                                <div>
                                  <p className='text-xs font-semibold uppercase text-primary'>Cliente selecionado</p>
                                  <p className='mt-1 text-sm font-semibold text-foreground'>{selectedProposalClient.name}</p>
                                  <p className='text-xs text-muted'>{selectedProposalClient.email}</p>
                                </div>
                                <button
                                  type='button'
                                  onClick={() => {
                                    setProposalForm((current) => ({ ...current, userId: '' }))
                                    setClientSearch('')
                                    setClientDropdownOpen(false)
                                  }}
                                  className='rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-background'
                                >
                                  Trocar
                                </button>
                              </div>
                            )}

                            {clientDropdownOpen && (
                              <div className='absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-2xl border border-border bg-surface shadow-xl'>
                                {filteredClients.length > 0 && (
                                  <div className='max-h-56 overflow-y-auto'>
                                    {filteredClients.map((client) => (
                                      <button
                                        key={client.id}
                                        type='button'
                                        onClick={() => {
                                          setProposalForm((current) => ({ ...current, userId: client.id }))
                                          setClientSearch(client.name)
                                          setClientDropdownOpen(false)
                                          setShowQuickClientForm(false)
                                        }}
                                        className={`flex w-full items-start justify-between gap-3 border-b border-border px-4 py-3 text-left transition last:border-b-0 hover:bg-surface-secondary ${
                                          proposalForm.userId === client.id ? 'bg-primary/6' : ''
                                        }`}
                                      >
                                        <span>
                                          <span className='block text-sm font-semibold text-foreground'>{client.name}</span>
                                          <span className='block text-xs text-muted'>{client.email}</span>
                                        </span>
                                        {proposalForm.userId === client.id && <span className='pill bg-primary/10 text-primary'>Selecionado</span>}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <button
                                  type='button'
                                  onClick={() => {
                                    const typed = clientSearch.trim()
                                    setQuickClient((current) => ({
                                      name: typed.includes('@') ? current.name : typed,
                                      email: typed.includes('@') ? typed : current.email,
                                    }))
                                    setShowQuickClientForm(true)
                                    setClientDropdownOpen(false)
                                  }}
                                  className='flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-primary transition hover:bg-primary/8'
                                >
                                  {filteredClients.length === 0 ? `Adicionar "${clientSearch.trim()}" como novo usuario` : 'Adicionar novo usuario'}
                                  <span aria-hidden='true'>+</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {showQuickClientForm && (
                            <div className='mt-4 rounded-2xl border border-border bg-surface p-4'>
                            <div className='flex items-start justify-between gap-3'>
                              <div>
                                <h4 className='text-sm font-semibold text-foreground'>Adicionar novo usuario</h4>
                                <p className='mt-1 text-xs text-muted'>Informe apenas os dados minimos para seguir com a proposta.</p>
                              </div>
                              <button
                                type='button'
                                onClick={() => setShowQuickClientForm(false)}
                                className='rounded-xl border border-border bg-surface-secondary px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-background'
                              >
                                Fechar
                              </button>
                            </div>
                            <div className='mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'>
                              <input
                                type='text'
                                value={quickClient.name}
                                onChange={(event) => setQuickClient((current) => ({ ...current, name: event.target.value }))}
                                placeholder='Nome'
                                className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                              />
                              <input
                                type='email'
                                value={quickClient.email}
                                onChange={(event) => setQuickClient((current) => ({ ...current, email: event.target.value }))}
                                placeholder='Email'
                                className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                              />
                              <button
                                type='button'
                                onClick={createQuickClient}
                                disabled={quickClientSaving}
                                className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-60'
                              >
                                {quickClientSaving ? 'Criando...' : 'Criar'}
                              </button>
                            </div>
                          </div>
                          )}
                        </div>
                        <label className='block md:col-span-2'>
                          <span className='mb-2 block text-sm font-semibold text-foreground'>Valor de venda</span>
                          <input
                            type='number'
                            min={0}
                            step='0.01'
                            value={simulatorForm.salePrice}
                            onChange={(event) => setSimulatorForm((current) => ({ ...current, salePrice: Number(event.target.value) || 0 }))}
                            className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                          />
                        </label>
                        <label className='block'>
                          <span className='mb-2 block text-sm font-semibold text-foreground'>Entrada</span>
                          <input
                            type='number'
                            min={0}
                            step='0.01'
                            value={simulatorForm.downPayment}
                            onChange={(event) => setSimulatorForm((current) => ({ ...current, downPayment: Math.min(Number(event.target.value) || 0, current.salePrice) }))}
                            className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                          />
                          <span className={`mt-2 block text-xs font-semibold ${commercialRules.belowMinimumDownPayment ? 'text-amber-700' : 'text-muted'}`}>
                            Minimo do empreendimento: {formatCurrency(commercialRules.minDownPayment)} ({commercialRules.minDownPaymentPercentage}%)
                          </span>
                        </label>
                        <label className='block'>
                          <span className='mb-2 block text-sm font-semibold text-foreground'>Parcelas</span>
                          <input
                            type='number'
                            min={1}
                            max={selectedLot.block.development?.settings?.maxInstallments ?? 240}
                            value={simulatorForm.installmentCount}
                            onChange={(event) => setSimulatorForm((current) => ({ ...current, installmentCount: Math.max(Number(event.target.value) || 1, 1) }))}
                            className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                          />
                          <span className={`mt-2 block text-xs font-semibold ${commercialRules.aboveMaxInstallments ? 'text-amber-700' : 'text-muted'}`}>
                            Maximo configurado: {commercialRules.maxInstallments} parcelas
                          </span>
                        </label>
                        <label className='block md:col-span-2'>
                          <span className='mb-2 block text-sm font-semibold text-foreground'>Observacao</span>
                          <textarea
                            rows={3}
                            value={proposalForm.notes}
                            onChange={(event) => setProposalForm((current) => ({ ...current, notes: event.target.value }))}
                            className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                            placeholder='Condição negociada, validade ou pontos relevantes'
                          />
                        </label>
                      </div>
                    </section>

                    <section className='rounded-2xl border border-border bg-surface-secondary p-5'>
                      <h3 className='text-base font-semibold text-foreground'>Juros e correcao</h3>
                      <div className='mt-5 grid gap-4 md:grid-cols-2'>
                        <label className='block'>
                          <span className='mb-2 block text-sm font-semibold text-foreground'>Juros ao mes</span>
                          <input
                            type='number'
                            min={0}
                            max={10}
                            step='0.01'
                            value={simulatorForm.interestRate}
                            onChange={(event) => setSimulatorForm((current) => ({ ...current, interestRate: Number(event.target.value) || 0 }))}
                            className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                          />
                        </label>
                        <label className='block'>
                          <span className='mb-2 block text-sm font-semibold text-foreground'>Tipo de juros</span>
                          <select
                            value={simulatorForm.interestCalculation}
                            onChange={(event) => setSimulatorForm((current) => ({ ...current, interestCalculation: event.target.value as DevelopmentSettings['interestCalculation'] }))}
                            className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                          >
                            <option value='none'>Sem juros</option>
                            <option value='simple'>Juros simples</option>
                            <option value='compound'>Juros compostos</option>
                          </select>
                        </label>
                        <label className='block'>
                          <span className='mb-2 block text-sm font-semibold text-foreground'>Correcao</span>
                          <select
                            value={simulatorForm.correctionIndex}
                            onChange={(event) => setSimulatorForm((current) => ({ ...current, correctionIndex: event.target.value as DevelopmentSettings['correctionIndex'] }))}
                            className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                          >
                            <option value='none'>Sem correcao</option>
                            <option value='ipca'>IPCA</option>
                            <option value='incc'>INCC</option>
                            <option value='igpm'>IGP-M</option>
                            <option value='fixed'>Percentual fixo</option>
                          </select>
                        </label>
                        <label className='block'>
                          <span className='mb-2 block text-sm font-semibold text-foreground'>Primeiro vencimento</span>
                          <input
                            type='date'
                            value={simulatorForm.firstDueDate}
                            onChange={(event) => setSimulatorForm((current) => ({ ...current, firstDueDate: event.target.value }))}
                            className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                          />
                        </label>
                      </div>
                    </section>

                    <div className='rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800'>
                      A correcao {simulatorForm.correctionIndex === 'none' ? 'nao sera aplicada nesta estimativa' : `${simulatorForm.correctionIndex.toUpperCase()} sera considerada como regra da proposta`}.
                    </div>

                    {commercialRules.hasException && (
                      <div className={`rounded-2xl border px-5 py-4 text-sm leading-6 ${
                        commercialRules.allowCustomTerms
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-red-200 bg-red-50 text-red-700'
                      }`}>
                        {commercialRules.allowCustomTerms
                          ? 'Esta proposta possui condicoes excepcionais. Ao salvar, ela sera enviada para aprovacao administrativa.'
                          : 'Esta proposta esta fora dos padroes do empreendimento. Ajuste entrada ou parcelas para salvar.'}
                      </div>
                    )}
                  </div>

                  <aside className='self-start lg:sticky lg:top-0'>
                    <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                      <h3 className='text-base font-semibold text-foreground'>Resumo</h3>
                      <div className='mt-5 space-y-4'>
                        <div className='rounded-xl border border-border bg-surface px-4 py-4'>
                          <p className='text-xs font-semibold uppercase text-muted'>Parcela estimada</p>
                          <p className='mt-2 text-2xl font-bold text-foreground'>{formatCurrency(simulation.installmentValue)}</p>
                        </div>
                        <div className='grid gap-3 text-sm'>
                          <div className='flex items-center justify-between gap-3'>
                            <span className='text-muted'>Entrada</span>
                            <span className='font-semibold text-foreground'>{formatCurrency(simulatorForm.downPayment)}</span>
                          </div>
                          <div className='flex items-center justify-between gap-3'>
                            <span className='text-muted'>Saldo a parcelar</span>
                            <span className='font-semibold text-foreground'>{formatCurrency(simulation.balance)}</span>
                          </div>
                          <div className='flex items-center justify-between gap-3'>
                            <span className='text-muted'>Total contratado</span>
                            <span className='font-semibold text-foreground'>{formatCurrency(simulation.totalContracted)}</span>
                          </div>
                          <div className='flex items-center justify-between gap-3'>
                            <span className='text-muted'>Custo financeiro</span>
                            <span className='font-semibold text-foreground'>{formatCurrency(simulation.interestCost)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>

              <div className='border-t border-border px-6 py-5'>
                <div className='flex flex-col gap-3 md:flex-row md:justify-end'>
                  <button
                    type='button'
                    onClick={() => setShowSimulator(false)}
                    className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'
                  >
                    Cancelar
                  </button>
                  <button
                    type='button'
                    disabled={!proposalCanBeSaved}
                    onClick={saveProposal}
                    className={`rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${
                      proposalCanBeSaved ? 'bg-primary hover:bg-primary-strong' : 'bg-primary opacity-60'
                    }`}
                  >
                    {proposalSaving ? 'Salvando...' : 'Salvar proposta'}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}

export default function LotsPage() {
  return (
    <Suspense fallback={<div className='h-24 animate-pulse rounded-2xl bg-surface-secondary' />}>
      <LotsContent />
    </Suspense>
  )
}
