'use client'

import { useEffect, useState } from 'react'
import FormDrawer from '@/app/components/FormDrawer'
import ImageUploadField from '@/app/components/ImageUploadField'

interface Company {
  id: string
  name: string
}

interface Development {
  id?: string
  name: string
  logo: string
  companyId: string
  settings?: DevelopmentSettings | null
  contractSettings?: DevelopmentContractSettings | null
  documentTemplateId?: string | null
}

type DocumentTemplateOption = {
  id: string
  name: string
  purpose: string
  status: string
  company: { id: string }
  versions: Array<{ status: string; version: number }>
}

type DevelopmentSettings = {
  reservationValidityDays: number
  defaultInterestRate: number
  interestCalculation: 'none' | 'simple' | 'compound'
  correctionIndex: 'none' | 'ipca' | 'incc' | 'igpm' | 'fixed'
  correctionFrequency: 'monthly' | 'annual'
  minDownPaymentPercentage: number
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
  minDownPaymentPercentage: 10,
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
  { id: 'basic', title: 'Dados principais', description: 'Empresa, nome e logo opcional' },
  { id: 'commercial', title: 'Regras comerciais', description: 'Reservas, juros e pagamento' },
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
      if (settingsData.maxInstallments < 1 || settingsData.maxInstallments > 240) newErrors.maxInstallments = 'Informe ate 240 parcelas.'
      if (settingsData.paymentMethods.length === 0) newErrors.paymentMethods = 'Selecione pelo menos uma forma de pagamento.'
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

  const updateContractSetting = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setContractSettingsData((prev) => ({ ...prev, [name]: value }))
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
                <label className='mb-2 block text-sm font-semibold text-foreground'>Empresa *</label>
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
                <input
                  type='number'
                  min={1}
                  max={180}
                  value={settingsData.reservationValidityDays}
                  onChange={(event) => updateSettingNumber('reservationValidityDays', Number(event.target.value))}
                  className={`w-full rounded-xl border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary ${
                    errors.reservationValidityDays ? 'border-red-300' : 'border-border'
                  }`}
                />
                {errors.reservationValidityDays && <p className='mt-2 text-sm text-red-600'>{errors.reservationValidityDays}</p>}
              </label>

              <label className='block'>
                <span className='mb-2 block text-sm font-semibold text-foreground'>Entrada minima (%)</span>
                <input
                  type='number'
                  min={0}
                  max={100}
                  step='0.01'
                  value={settingsData.minDownPaymentPercentage}
                  onChange={(event) => updateSettingNumber('minDownPaymentPercentage', Number(event.target.value))}
                  className={`w-full rounded-xl border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary ${
                    errors.minDownPaymentPercentage ? 'border-red-300' : 'border-border'
                  }`}
                />
                {errors.minDownPaymentPercentage && <p className='mt-2 text-sm text-red-600'>{errors.minDownPaymentPercentage}</p>}
              </label>

              <label className='block'>
                <span className='mb-2 block text-sm font-semibold text-foreground'>Maximo de parcelas</span>
                <input
                  type='number'
                  min={1}
                  max={240}
                  value={settingsData.maxInstallments}
                  onChange={(event) => updateSettingNumber('maxInstallments', Number(event.target.value))}
                  className={`w-full rounded-xl border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary ${
                    errors.maxInstallments ? 'border-red-300' : 'border-border'
                  }`}
                />
                {errors.maxInstallments && <p className='mt-2 text-sm text-red-600'>{errors.maxInstallments}</p>}
              </label>

              <label className='block'>
                <span className='mb-2 block text-sm font-semibold text-foreground'>Juros ao mes (%)</span>
                <input
                  type='number'
                  min={0}
                  max={10}
                  step='0.01'
                  value={settingsData.defaultInterestRate}
                  onChange={(event) => updateSettingNumber('defaultInterestRate', Number(event.target.value))}
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
          </div>
          )}

          {development?.id && currentSection === 'documents' && (
          <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
            <div>
              <h3 className='text-base font-semibold text-foreground'>Documentos da venda</h3>
              <p className='mt-1 text-sm text-muted'>Defina o modelo de contrato usado nas vendas deste empreendimento.</p>
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
                  {documentTemplates
                    .filter((template) =>
                      template.company.id === formData.companyId &&
                      template.purpose === 'sale_contract' &&
                      template.status === 'published' &&
                      template.versions.some((version) => version.status === 'published'),
                    )
                    .map((template) => {
                      const published = template.versions.find((version) => version.status === 'published')
                      return <option key={template.id} value={template.id}>{template.name} (v{published?.version})</option>
                    })}
                </select>
                {errors.documentTemplateId && <p className='mt-2 text-sm text-red-600'>{errors.documentTemplateId}</p>}
                <p className='mt-2 text-xs text-muted'>Somente modelos publicados da empresa selecionada podem ser usados.</p>
              </label>
              <div className='rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted'>
                O conteúdo, as variáveis e os dados do contrato são configurados em <strong className='text-foreground'>Modelos → Configurar uso</strong>. Aqui você apenas escolhe qual modelo será aplicado às vendas.
              </div>
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
