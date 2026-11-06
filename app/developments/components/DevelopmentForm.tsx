'use client'

import { useEffect, useState } from 'react'
import FormDrawer from '@/app/components/FormDrawer'
import ImageUploadField from '@/app/components/ImageUploadField'
import { NumberTextInput } from '@/app/components/NumberTextInput'

interface Company {
  id: string
  name: string
}

interface Development {
  id?: string
  name: string
  logo: string
  companyId: string
  company?: Company
  settings?: DevelopmentSettings | null
  contractSettings?: DevelopmentContractSettings | null
  documentTemplateId?: string | null
}

type DocumentTemplateOption = {
  id: string
  name: string
  description?: string | null
  purpose: string
  status: string
  company: { id: string }
  versions: Array<{ id: string; status: string; version: number; variables: string[] }>
}

type DevelopmentSettings = {
  reservationValidityDays: number
  defaultInterestRate: number
  interestCalculation: 'none' | 'simple' | 'compound'
  correctionIndex: 'none' | 'ipca' | 'incc' | 'igpm' | 'fixed'
  correctionFrequency: 'monthly' | 'annual'
  autoIssueBoleto: boolean
  autoIssueBoletoDaysBefore: number
  automaticBoletoProvider: 'auto' | 'asaas' | 'inter'
  autoSendBoletoEmail: boolean
  overdueEmailEnabled: boolean
  overdueFirstReminderDays: number
  overdueSecondReminderDays: number
  boletoEmailSubject: string
  boletoEmailTemplate: string
  overdueEmailSubject: string
  overdueEmailTemplate: string
  overdueSecondEmailSubject: string
  overdueSecondEmailTemplate: string
  minDownPaymentPercentage: number
  defaultCommissionPercentage: number
  allowDownPaymentInstallments: boolean
  maxDownPaymentInstallments: number
  maxInstallments: number
  paymentMethods: string[] | string
  allowCustomTerms: boolean
}

type DevelopmentSettingsFormData = Omit<DevelopmentSettings, 'paymentMethods'> & {
  paymentMethods: string[]
}

type DevelopmentContractSettings = {
  sellerName: string
  sellerDocument: string
  sellerAddress: string
  sellerRepresentatives: string
  propertyDescription: string
  acquisitionDescription: string
  paymentInstructions: string
  jurisdiction: string
  additionalClauses: string
}

interface DevelopmentFormProps {
  development?: Development | null
  companies: Company[]
  isOpen: boolean
  initialSection?: ConfigSection
  onClose: () => void
  onSave: (mode: 'create' | 'update', development: Development) => void
}

const defaultSettings: DevelopmentSettingsFormData = {
  reservationValidityDays: 7,
  defaultInterestRate: 0,
  interestCalculation: 'none',
  correctionIndex: 'none',
  correctionFrequency: 'monthly',
  autoIssueBoleto: false,
  autoIssueBoletoDaysBefore: 7,
  automaticBoletoProvider: 'auto',
  autoSendBoletoEmail: false,
  overdueEmailEnabled: false,
  overdueFirstReminderDays: 3,
  overdueSecondReminderDays: 10,
  boletoEmailSubject: 'Boleto da parcela - {{empreendimento}}',
  boletoEmailTemplate: 'Olá, {{cliente}}!\n\nSegue o boleto da parcela {{parcela}} do empreendimento {{empreendimento}}, no valor de {{valor}}, com vencimento em {{vencimento}}.\n\n{{link_boleto}}\n\nSe já realizou o pagamento, desconsidere esta mensagem.',
  overdueEmailSubject: 'Parcela em aberto - {{empreendimento}}',
  overdueEmailTemplate: 'Olá, {{cliente}}!\n\nA parcela {{parcela}} do empreendimento {{empreendimento}}, no valor de {{valor}}, venceu em {{vencimento}} e consta em aberto.\n\n{{link_boleto}}\n\nSe já realizou o pagamento, desconsidere esta mensagem.',
  overdueSecondEmailSubject: 'Segundo aviso de parcela em aberto - {{empreendimento}}',
  overdueSecondEmailTemplate: 'Olá, {{cliente}}!\n\nEsta é uma nova tentativa de contato sobre a parcela {{parcela}} do empreendimento {{empreendimento}}, no valor de {{valor}}, vencida em {{vencimento}}. Ela ainda consta em aberto em nosso sistema.\n\n{{link_boleto}}\n\nSe já realizou o pagamento, desconsidere esta mensagem.',
  minDownPaymentPercentage: 10,
  defaultCommissionPercentage: 6,
  allowDownPaymentInstallments: false,
  maxDownPaymentInstallments: 1,
  maxInstallments: 120,
  paymentMethods: ['cash', 'installments'],
  allowCustomTerms: true,
}

const defaultContractSettings: DevelopmentContractSettings = {
  sellerName: '',
  sellerDocument: '',
  sellerAddress: '',
  sellerRepresentatives: '',
  propertyDescription: '',
  acquisitionDescription: '',
  paymentInstructions: '',
  jurisdiction: '',
  additionalClauses: '',
}

type ConfigSection = 'basic' | 'commercial' | 'documents'

const configSections: Array<{ id: ConfigSection; title: string; description: string }> = [
  { id: 'basic', title: 'Empresa e dados', description: 'Empresa, nome e logo opcional' },
  { id: 'commercial', title: 'Regras comerciais', description: 'Reservas, pagamentos e cobranças' },
  { id: 'documents', title: 'Documento de venda', description: 'Modelo de contrato' },
]

export default function DevelopmentForm({
  development,
  companies,
  isOpen,
  initialSection = 'basic',
  onClose,
  onSave,
}: DevelopmentFormProps) {
  const [formData, setFormData] = useState<Development>({ name: '', logo: '', companyId: '' })
  const [settingsData, setSettingsData] = useState<DevelopmentSettingsFormData>(defaultSettings)
  const [contractSettingsData, setContractSettingsData] = useState<DevelopmentContractSettings>(defaultContractSettings)
  const [documentTemplates, setDocumentTemplates] = useState<DocumentTemplateOption[]>([])
  const [currentSection, setCurrentSection] = useState<ConfigSection>('basic')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const availableDocumentTemplates = documentTemplates.filter((template) =>
    template.company.id === formData.companyId &&
    template.purpose === 'sale_contract' &&
    template.status === 'published' &&
    template.versions.some((version) => version.status === 'published'),
  )
  const selectedDocumentTemplate = availableDocumentTemplates.find((template) => template.id === formData.documentTemplateId) ?? null
  const selectedPublishedVersion = selectedDocumentTemplate?.versions.find((version) => version.status === 'published') ?? null
  const selectedCompany = companies.find((company) => company.id === formData.companyId) ?? null
  const originalCompany = development ? companies.find((company) => company.id === development.companyId) ?? development.company ?? null : null
  const companyChanged = Boolean(development?.id && originalCompany && formData.companyId && formData.companyId !== originalCompany.id)
  const documentTemplatesHref = `/document-templates?companyId=${encodeURIComponent(formData.companyId || '')}${development?.id ? `&developmentId=${encodeURIComponent(development.id)}` : ''}`
  const newDocumentTemplateHref = `${documentTemplatesHref}&new=1`

  useEffect(() => {
    setFormData(
      development
        ? { id: development.id, name: development.name, logo: development.logo, companyId: development.companyId, settings: development.settings, contractSettings: development.contractSettings, documentTemplateId: development.documentTemplateId }
        : { name: '', logo: '', companyId: companies[0]?.id ?? '', documentTemplateId: null },
    )
    setSettingsData(
      development?.settings
        ? {
            ...defaultSettings,
            ...development.settings,
            paymentMethods: Array.isArray(development.settings.paymentMethods)
              ? development.settings.paymentMethods
              : String(development.settings.paymentMethods || defaultSettings.paymentMethods.join(',')).split(',').filter(Boolean),
          }
        : defaultSettings,
    )
    setContractSettingsData(development?.contractSettings ? { ...defaultContractSettings, ...development.contractSettings } : defaultContractSettings)
    setCurrentSection(development ? initialSection : 'basic')
    setErrors({})
  }, [development, isOpen, companies, initialSection])

  useEffect(() => {
    if (!isOpen) return
    fetch('/api/document-templates', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : [])
      .then(setDocumentTemplates)
      .catch(() => setDocumentTemplates([]))
  }, [isOpen])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'companyId' ? { documentTemplateId: null } : {}),
    }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validateForm = (section: ConfigSection = currentSection) => {
    const newErrors: Record<string, string> = {}

    if (section === 'basic') {
      if (!formData.name.trim()) newErrors.name = 'Nome é obrigatório'
      if (!formData.companyId) newErrors.companyId = 'Selecione uma empresa'
    }

    if (section === 'commercial') {
      if (settingsData.reservationValidityDays < 1 || settingsData.reservationValidityDays > 180) newErrors.reservationValidityDays = 'Informe entre 1 e 180 dias.'
      if (settingsData.defaultInterestRate < 0 || settingsData.defaultInterestRate > 10) newErrors.defaultInterestRate = 'Informe entre 0% e 10% ao mes.'
      if (settingsData.minDownPaymentPercentage < 0 || settingsData.minDownPaymentPercentage > 100) newErrors.minDownPaymentPercentage = 'Informe entre 0% e 100%.'
      if (settingsData.defaultCommissionPercentage < 0 || settingsData.defaultCommissionPercentage > 100) newErrors.defaultCommissionPercentage = 'Informe entre 0% e 100%.'
      if (settingsData.maxInstallments < 1 || settingsData.maxInstallments > 240) newErrors.maxInstallments = 'Informe ate 240 parcelas.'
      if (settingsData.allowDownPaymentInstallments && (settingsData.maxDownPaymentInstallments < 2 || settingsData.maxDownPaymentInstallments > 24)) newErrors.maxDownPaymentInstallments = 'Informe entre 2 e 24 parcelas.'
      if (settingsData.paymentMethods.length === 0) newErrors.paymentMethods = 'Selecione pelo menos uma forma de pagamento.'
      if (settingsData.autoIssueBoletoDaysBefore < 1 || settingsData.autoIssueBoletoDaysBefore > 60) newErrors.autoIssueBoletoDaysBefore = 'Informe entre 1 e 60 dias.'
      if (settingsData.overdueFirstReminderDays < 1 || settingsData.overdueFirstReminderDays > 60) newErrors.overdueFirstReminderDays = 'Informe entre 1 e 60 dias.'
      if (settingsData.overdueSecondReminderDays <= settingsData.overdueFirstReminderDays || settingsData.overdueSecondReminderDays > 90) newErrors.overdueSecondReminderDays = 'O segundo aviso deve ser posterior ao primeiro e ocorrer em ate 90 dias.'
    }

    if (section === 'documents' && !formData.documentTemplateId) {
      newErrors.documentTemplateId = 'Selecione um modelo de contrato publicado'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const updateSettingNumber = (name: keyof DevelopmentSettings, value: number) => {
    setSettingsData((prev) => ({ ...prev, [name]: Number.isFinite(value) ? value : 0 }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const updateSettingText = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target
    setSettingsData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const togglePaymentMethod = (method: string) => {
    setSettingsData((prev) => ({
      ...prev,
      paymentMethods: prev.paymentMethods.includes(method)
        ? prev.paymentMethods.filter((item) => item !== method)
        : [...prev.paymentMethods, method],
    }))
    if (errors.paymentMethods) setErrors((prev) => ({ ...prev, paymentMethods: '' }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setLoading(true)
    try {
      const url = development?.id ? `/api/developments/${development.id}` : '/api/developments'
      const method = development?.id ? 'PUT' : 'POST'
      const body: Record<string, unknown> = {
        id: formData.id,
        name: formData.name,
        logo: formData.logo,
        companyId: formData.companyId,
        documentTemplateId: formData.documentTemplateId ?? null,
      }
      if (currentSection === 'commercial') body.settings = settingsData
      if (currentSection === 'documents') body.contractSettings = contractSettingsData
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao salvar empreendimento')
      }
      if (development?.id && currentSection === 'commercial') {
        const settingsResponse = await fetch(`/api/developments/${development.id}/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settingsData),
        })
        if (!settingsResponse.ok) {
          const payload = await settingsResponse.json().catch(() => ({}))
          if (payload.errors) setErrors(payload.errors)
          throw new Error(payload.error || 'Erro ao salvar automações de cobrança.')
        }
      }
      const savedDevelopment = await response.json()
      onSave(development?.id ? 'update' : 'create', savedDevelopment)
      onClose()
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : 'Erro ao salvar empreendimento' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <FormDrawer
      isOpen={isOpen}
      title={development?.id ? 'Configurar Empreendimento' : 'Novo Empreendimento'}
      description={development?.id ? 'Atualize qualquer parte da configuracao sem depender de uma ordem fixa.' : 'Crie o empreendimento com o minimo necessario. Depois configure regras, documento e lotes em qualquer ordem.'}
      onClose={onClose}
      widthClassName='max-w-4xl'
    >
      <form onSubmit={handleSubmit} className='space-y-6'>
        {errors.submit && (
          <div className='rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>
            {errors.submit}
          </div>
        )}

        {development?.id && (
        <div className='grid gap-3 md:grid-cols-3'>
          {configSections.map((section) => {
            const active = section.id === currentSection
            return (
              <button
                key={section.id}
                type='button'
                onClick={() => { setCurrentSection(section.id); setErrors({}) }}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  active
                    ? 'border-primary bg-primary/8 text-primary'
                    : 'border-border bg-surface-secondary text-muted'
                }`}
              >
                <span className='mt-1 block text-sm font-semibold'>{section.title}</span>
                <span className='mt-1 block text-xs'>{section.description}</span>
              </button>
            )
          })}
        </div>
        )}

        <div className='grid gap-6'>
          {currentSection === 'basic' && (
            <div className='grid gap-5'>
              <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                <label className='mb-2 block text-sm font-semibold text-foreground'>Empresa vinculada *</label>
                <select
                  name='companyId'
                  value={formData.companyId}
                  onChange={handleInputChange}
                  className={`w-full rounded-xl border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary ${
                    errors.companyId ? 'border-red-300' : 'border-border'
                  }`}
                >
                  <option value=''>Selecione uma empresa</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
                {errors.companyId && <p className='mt-2 text-sm text-red-600'>{errors.companyId}</p>}
                <p className='mt-2 text-xs text-muted'>
                  Esta empresa define permissoes, modelos de contrato e provedores de pagamento disponiveis para o empreendimento.
                </p>
                {companyChanged && (
                  <div className='mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800'>
                    Ao salvar, o empreendimento sai de {originalCompany?.name} e passa para {selectedCompany?.name}. O modelo de contrato foi limpo porque ele precisa pertencer a nova empresa.
                  </div>
                )}
              </div>

              <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                <label className='mb-2 block text-sm font-semibold text-foreground'>Nome do Empreendimento *</label>
                <input
                  type='text'
                  name='name'
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`w-full rounded-xl border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary ${
                    errors.name ? 'border-red-300' : 'border-border'
                  }`}
                  placeholder='Loteamento Cajueiro I'
                />
                {errors.name && <p className='mt-2 text-sm text-red-600'>{errors.name}</p>}
              </div>

              <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                <ImageUploadField
                  label='Logo'
                  value={formData.logo}
                  onChange={(logo) => {
                    setFormData((current) => ({ ...current, logo }))
                    setErrors((current) => ({ ...current, logo: '' }))
                  }}
                  error={errors.logo}
                  onError={(logoError) => setErrors((current) => ({ ...current, logo: logoError }))}
                  previewAlt={formData.name || 'Logo do empreendimento'}
                />
              </div>
            </div>
          )}

          {development?.id && currentSection === 'commercial' && (
          <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
            <div>
              <h3 className='text-base font-semibold text-foreground'>Regras comerciais</h3>
              <p className='mt-1 text-sm text-muted'>Esses padroes serao usados em reservas, simulacoes e vendas.</p>
            </div>

            <div className='mt-5 grid gap-4 md:grid-cols-2'>
              <label className='block'>
                <span className='mb-2 block text-sm font-semibold text-foreground'>Validade da reserva</span>
                <NumberTextInput
                  min={1}
                  max={180}
                  value={settingsData.reservationValidityDays}
                  onValueChange={(value) => updateSettingNumber('reservationValidityDays', value)}
                  className={`w-full rounded-xl border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary ${
                    errors.reservationValidityDays ? 'border-red-300' : 'border-border'
                  }`}
                />
                {errors.reservationValidityDays && <p className='mt-2 text-sm text-red-600'>{errors.reservationValidityDays}</p>}
              </label>

              <label className='block'>
                <span className='mb-2 block text-sm font-semibold text-foreground'>Entrada minima (%)</span>
                <NumberTextInput
                  min={0}
                  max={100}
                  step='0.01'
                  value={settingsData.minDownPaymentPercentage}
                  onValueChange={(value) => updateSettingNumber('minDownPaymentPercentage', value)}
                  className={`w-full rounded-xl border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary ${
                    errors.minDownPaymentPercentage ? 'border-red-300' : 'border-border'
                  }`}
                />
                {errors.minDownPaymentPercentage && <p className='mt-2 text-sm text-red-600'>{errors.minDownPaymentPercentage}</p>}
              </label>

              <label className='block'>
                <span className='mb-2 block text-sm font-semibold text-foreground'>Maximo de parcelas</span>
                <NumberTextInput
                  min={1}
                  max={240}
                  value={settingsData.maxInstallments}
                  onValueChange={(value) => updateSettingNumber('maxInstallments', value)}
                  className={`w-full rounded-xl border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary ${
                    errors.maxInstallments ? 'border-red-300' : 'border-border'
                  }`}
                />
                {errors.maxInstallments && <p className='mt-2 text-sm text-red-600'>{errors.maxInstallments}</p>}
              </label>

              <label className='block'>
                <span className='mb-2 block text-sm font-semibold text-foreground'>Comissao padrao (%)</span>
                <NumberTextInput min={0} max={100} step='0.01' value={settingsData.defaultCommissionPercentage} onValueChange={(value) => updateSettingNumber('defaultCommissionPercentage', value)} className={`w-full rounded-xl border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary ${errors.defaultCommissionPercentage ? 'border-red-300' : 'border-border'}`} />
                {errors.defaultCommissionPercentage && <p className='mt-2 text-sm text-red-600'>{errors.defaultCommissionPercentage}</p>}
              </label>

              <div className='rounded-xl border border-border bg-surface p-4 md:col-span-2'>
                <label className='flex items-center gap-3 text-sm font-semibold text-foreground'>
                  <input type='checkbox' checked={settingsData.allowDownPaymentInstallments} onChange={(event) => setSettingsData((current) => ({ ...current, allowDownPaymentInstallments: event.target.checked, maxDownPaymentInstallments: event.target.checked ? Math.max(current.maxDownPaymentInstallments, 2) : 1 }))} className='h-4 w-4 rounded border-border text-primary focus:ring-primary' />
                  Permitir parcelamento da entrada
                </label>
                {settingsData.allowDownPaymentInstallments && (
                  <label className='mt-4 block max-w-xs'>
                    <span className='mb-2 block text-sm font-semibold text-foreground'>Maximo de parcelas da entrada</span>
                    <NumberTextInput min={2} max={24} value={settingsData.maxDownPaymentInstallments} onValueChange={(value) => updateSettingNumber('maxDownPaymentInstallments', Math.trunc(value))} className={`w-full rounded-xl border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary ${errors.maxDownPaymentInstallments ? 'border-red-300' : 'border-border'}`} />
                    {errors.maxDownPaymentInstallments && <p className='mt-2 text-sm text-red-600'>{errors.maxDownPaymentInstallments}</p>}
                  </label>
                )}
              </div>

              <label className='block'>
                <span className='mb-2 block text-sm font-semibold text-foreground'>Juros ao mes (%)</span>
                <NumberTextInput
                  min={0}
                  max={10}
                  step='0.01'
                  value={settingsData.defaultInterestRate}
                  onValueChange={(value) => updateSettingNumber('defaultInterestRate', value)}
                  className={`w-full rounded-xl border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary ${
                    errors.defaultInterestRate ? 'border-red-300' : 'border-border'
                  }`}
                />
                {errors.defaultInterestRate && <p className='mt-2 text-sm text-red-600'>{errors.defaultInterestRate}</p>}
              </label>

              <label className='block'>
                <span className='mb-2 block text-sm font-semibold text-foreground'>Tipo de juros</span>
                <select
                  name='interestCalculation'
                  value={settingsData.interestCalculation}
                  onChange={updateSettingText}
                  className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary'
                >
                  <option value='none'>Sem juros</option>
                  <option value='simple'>Juros simples</option>
                  <option value='compound'>Juros compostos</option>
                </select>
              </label>

              <label className='block'>
                <span className='mb-2 block text-sm font-semibold text-foreground'>Indice de correcao</span>
                <select
                  name='correctionIndex'
                  value={settingsData.correctionIndex}
                  onChange={updateSettingText}
                  className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary'
                >
                  <option value='none'>Sem correcao</option>
                  <option value='ipca'>IPCA</option>
                  <option value='incc'>INCC</option>
                  <option value='igpm'>IGP-M</option>
                  <option value='fixed'>Percentual fixo</option>
                </select>
              </label>
            </div>

            <div className='mt-5'>
              <p className='mb-3 text-sm font-semibold text-foreground'>Formas de pagamento</p>
              <div className='grid gap-2 sm:grid-cols-2'>
                {[
                  ['cash', 'A vista'],
                  ['installments', 'Parcelamento proprio'],
                  ['financing', 'Financiamento'],
                  ['bank_slip', 'Boleto'],
                  ['pix', 'Pix'],
                ].map(([value, label]) => (
                  <label key={value} className='flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground'>
                    <input
                      type='checkbox'
                      checked={settingsData.paymentMethods.includes(value)}
                      onChange={() => togglePaymentMethod(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
              {errors.paymentMethods && <p className='mt-2 text-sm text-red-600'>{errors.paymentMethods}</p>}
            </div>

            <label className='mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3'>
              <input
                type='checkbox'
                checked={settingsData.allowCustomTerms}
                onChange={(event) => setSettingsData((prev) => ({ ...prev, allowCustomTerms: event.target.checked }))}
                className='mt-1'
              />
              <span>
                <span className='block text-sm font-semibold text-foreground'>Permitir condicoes customizadas</span>
                <span className='mt-1 block text-sm text-muted'>Quando ativo, a equipe pode ajustar condicoes na simulacao com criterio comercial.</span>
              </span>
            </label>

            <section className='mt-5 rounded-2xl border border-border bg-surface-secondary p-5'>
              <h3 className='text-base font-semibold text-foreground'>Automação de cobranças</h3>
              <p className='mt-1 text-sm text-muted'>Configure a emissão de boletos e os e-mails deste empreendimento. As automações começam desativadas.</p>
              <label className='mt-4 flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground'>
                <input type='checkbox' checked={settingsData.autoIssueBoleto} onChange={(event) => setSettingsData((current) => ({ ...current, autoIssueBoleto: event.target.checked }))} className='mt-1' />
                <span>Gerar boletos automaticamente antes do vencimento</span>
              </label>
              {settingsData.autoIssueBoleto && <div className='mt-4 grid gap-4 sm:grid-cols-2'>
                <label className='block'>
                  <span className='mb-2 block text-sm font-semibold text-foreground'>Provedor para emissão automática</span>
                  <select name='automaticBoletoProvider' value={settingsData.automaticBoletoProvider} onChange={updateSettingText} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground'>
                    <option value='auto'>Usar automaticamente se houver apenas um ativo</option>
                    <option value='asaas'>Asaas</option>
                    <option value='inter'>Banco Inter</option>
                  </select>
                  <p className='mt-2 text-xs text-muted'>Se houver mais de um provedor ativo, escolha qual deve emitir os boletos.</p>
                </label>
                <label className='block max-w-xs'>
                <span className='mb-2 block text-sm font-semibold text-foreground'>Antecedência (dias)</span>
                <NumberTextInput min={1} max={60} value={settingsData.autoIssueBoletoDaysBefore} onValueChange={(value) => updateSettingNumber('autoIssueBoletoDaysBefore', Math.trunc(value))} className={`w-full rounded-xl border bg-surface px-4 py-3 text-sm text-foreground ${errors.autoIssueBoletoDaysBefore ? 'border-red-300' : 'border-border'}`} />
                {errors.autoIssueBoletoDaysBefore && <p className='mt-2 text-sm text-red-600'>{errors.autoIssueBoletoDaysBefore}</p>}
                </label>
              </div>}
              <label className='mt-4 flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground'>
                <input type='checkbox' checked={settingsData.autoSendBoletoEmail} onChange={(event) => setSettingsData((current) => ({ ...current, autoSendBoletoEmail: event.target.checked }))} className='mt-1' />
                <span>Enviar o boleto por e-mail quando estiver disponível</span>
              </label>
              {settingsData.autoSendBoletoEmail && <div className='mt-4 space-y-3'>
                <label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>Assunto do e-mail do boleto</span><input value={settingsData.boletoEmailSubject} onChange={(event) => setSettingsData((current) => ({ ...current, boletoEmailSubject: event.target.value }))} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground' /></label>
                <label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>Mensagem</span><textarea rows={5} value={settingsData.boletoEmailTemplate} onChange={(event) => setSettingsData((current) => ({ ...current, boletoEmailTemplate: event.target.value }))} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground' /></label>
              </div>}
              <label className='mt-5 flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground'>
                <input type='checkbox' checked={settingsData.overdueEmailEnabled} onChange={(event) => setSettingsData((current) => ({ ...current, overdueEmailEnabled: event.target.checked }))} className='mt-1' />
                <span>Enviar avisos de inadimplência por e-mail</span>
              </label>
              {settingsData.overdueEmailEnabled && <div className='mt-4 space-y-4'>
                <div className='grid gap-4 sm:grid-cols-2'>
                  <label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>Primeiro aviso após (dias)</span><NumberTextInput min={1} max={60} value={settingsData.overdueFirstReminderDays} onValueChange={(value) => updateSettingNumber('overdueFirstReminderDays', Math.trunc(value))} className={`w-full rounded-xl border bg-surface px-4 py-3 text-sm text-foreground ${errors.overdueFirstReminderDays ? 'border-red-300' : 'border-border'}`} />{errors.overdueFirstReminderDays && <p className='mt-2 text-sm text-red-600'>{errors.overdueFirstReminderDays}</p>}</label>
                  <label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>Segundo aviso após (dias)</span><NumberTextInput min={2} max={90} value={settingsData.overdueSecondReminderDays} onValueChange={(value) => updateSettingNumber('overdueSecondReminderDays', Math.trunc(value))} className={`w-full rounded-xl border bg-surface px-4 py-3 text-sm text-foreground ${errors.overdueSecondReminderDays ? 'border-red-300' : 'border-border'}`} />{errors.overdueSecondReminderDays && <p className='mt-2 text-sm text-red-600'>{errors.overdueSecondReminderDays}</p>}</label>
                </div>
                <label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>Assunto do primeiro aviso</span><input value={settingsData.overdueEmailSubject} onChange={(event) => setSettingsData((current) => ({ ...current, overdueEmailSubject: event.target.value }))} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground' /></label>
                <label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>Mensagem do primeiro aviso</span><textarea rows={5} value={settingsData.overdueEmailTemplate} onChange={(event) => setSettingsData((current) => ({ ...current, overdueEmailTemplate: event.target.value }))} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground' /></label>
                <label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>Assunto do segundo aviso</span><input value={settingsData.overdueSecondEmailSubject} onChange={(event) => setSettingsData((current) => ({ ...current, overdueSecondEmailSubject: event.target.value }))} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground' /></label>
                <label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>Mensagem do segundo aviso</span><textarea rows={5} value={settingsData.overdueSecondEmailTemplate} onChange={(event) => setSettingsData((current) => ({ ...current, overdueSecondEmailTemplate: event.target.value }))} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground' /></label>
              </div>}
              <p className='mt-4 text-xs leading-5 text-muted'>Variáveis disponíveis: {'{{cliente}}'}, {'{{empreendimento}}'}, {'{{parcela}}'}, {'{{valor}}'}, {'{{vencimento}}'} e {'{{link_boleto}}'}.</p>
            </section>
          </div>
          )}

          {development?.id && currentSection === 'documents' && (
          <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
              <div>
                <h3 className='text-base font-semibold text-foreground'>Documentos da venda</h3>
                <p className='mt-1 text-sm text-muted'>Escolha o modelo aplicado às vendas deste empreendimento.</p>
              </div>
              <div className='flex flex-wrap gap-2'>
                <a
                  href={newDocumentTemplateHref}
                  target='_blank'
                  rel='noreferrer'
                  className='rounded-xl bg-primary px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-primary-strong'
                >
                  Criar modelo
                </a>
                <a
                  href={documentTemplatesHref}
                  target='_blank'
                  rel='noreferrer'
                  className='rounded-xl border border-border bg-surface px-3 py-2 text-center text-sm font-semibold text-foreground transition hover:bg-background'
                >
                  Ver modelos
                </a>
              </div>
            </div>

            <div className='mt-5 grid gap-4'>
              <label className='block'>
                <span className='mb-2 block text-sm font-semibold text-foreground'>Modelo de contrato</span>
                <select
                  name='documentTemplateId'
                  value={formData.documentTemplateId ?? ''}
                  onChange={handleInputChange}
                  className={`w-full rounded-xl border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary ${
                    errors.documentTemplateId ? 'border-red-300' : 'border-border'
                  }`}
                >
                  <option value=''>Selecione um modelo publicado</option>
                  {availableDocumentTemplates
                    .map((template) => {
                      const published = template.versions.find((version) => version.status === 'published')
                      return <option key={template.id} value={template.id}>{template.name} (v{published?.version})</option>
                    })}
                </select>
                {errors.documentTemplateId && <p className='mt-2 text-sm text-red-600'>{errors.documentTemplateId}</p>}
                <p className='mt-2 text-xs text-muted'>Esta é a mesma configuração alterada em Modelos de documentos ao aplicar um modelo a empreendimentos.</p>
              </label>

              {availableDocumentTemplates.length === 0 && (
                <div className='rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'>
                  Esta empresa ainda nao tem modelo publicado. Use Criar modelo para enviar um DOCX ja vinculado a esta empresa.
                </div>
              )}

              {selectedDocumentTemplate && selectedPublishedVersion && (
                <div className='rounded-xl border border-border bg-surface px-4 py-4'>
                  <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                    <div>
                      <p className='text-sm font-semibold text-foreground'>{selectedDocumentTemplate.name} v{selectedPublishedVersion.version}</p>
                      {selectedDocumentTemplate.description && (
                        <p className='mt-1 text-sm text-muted'>{selectedDocumentTemplate.description}</p>
                      )}
                    </div>
                    <a
                      href={`/api/document-templates/${selectedDocumentTemplate.id}/preview?versionId=${selectedPublishedVersion.id}`}
                      target='_blank'
                      rel='noreferrer'
                      className='rounded-xl border border-primary px-3 py-2 text-center text-sm font-semibold text-primary transition hover:bg-primary/8'
                    >
                      Preview preenchido
                    </a>
                  </div>

                </div>
              )}
            </div>
          </div>
          )}
        </div>

        <div className='flex flex-col gap-3 border-t border-border pt-6 md:flex-row md:items-center md:justify-between'>
          <button type='button' onClick={onClose} disabled={loading} className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary disabled:opacity-50'>Cancelar</button>
          <button type='submit' disabled={loading} className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-50'>
            {loading ? 'Salvando...' : development?.id ? 'Salvar configuracao' : 'Criar Empreendimento'}
          </button>
        </div>
      </form>
    </FormDrawer>
  )
}
