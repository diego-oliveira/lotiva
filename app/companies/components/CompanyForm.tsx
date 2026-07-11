'use client'

import { useEffect, useState } from 'react'
import FormDrawer from '@/app/components/FormDrawer'
import ImageUploadField from '@/app/components/ImageUploadField'

interface Company {
  id?: string
  name: string
  logo: string
  legalName?: string
  document?: string
  stateRegistration?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  phone?: string
  email?: string
}

interface CompanyFormProps {
  company?: Company | null
  isOpen: boolean
  onClose: () => void
  onSave: (mode: 'create' | 'update', company: Company, options: { close: boolean }) => void | Promise<void>
}

export default function CompanyForm({
  company,
  isOpen,
  onClose,
  onSave,
}: CompanyFormProps) {
  const [formData, setFormData] = useState<Company>({ name: '', logo: '' })
  const [activeSection, setActiveSection] = useState<'basic' | 'legal' | 'contact'>('basic')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const onlyDigits = (value: string) => value.replace(/\D/g, '')

  const formatCnpj = (value: string) => {
    const digits = onlyDigits(value).slice(0, 14)
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }

  const formatZipCode = (value: string) => {
    const digits = onlyDigits(value).slice(0, 8)
    return digits.replace(/^(\d{5})(\d)/, '$1-$2')
  }

  const formatPhone = (value: string) => {
    const digits = onlyDigits(value).slice(0, 11)
    if (digits.length <= 10) {
      return digits
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2')
    }
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
  }

  const formatFieldValue = (name: string, value: string) => {
    if (name === 'document') return formatCnpj(value)
    if (name === 'zipCode') return formatZipCode(value)
    if (name === 'phone') return formatPhone(value)
    if (name === 'state') return value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2)
    return value
  }

  useEffect(() => {
    setFormData(
      company
        ? {
            id: company.id,
            name: company.name,
            logo: company.logo,
            legalName: company.legalName ?? '',
            document: formatCnpj(company.document ?? ''),
            stateRegistration: company.stateRegistration ?? '',
            address: company.address ?? '',
            city: company.city ?? '',
            state: formatFieldValue('state', company.state ?? ''),
            zipCode: formatZipCode(company.zipCode ?? ''),
            phone: formatPhone(company.phone ?? ''),
            email: company.email ?? '',
          }
        : {
            name: '',
            logo: '',
            legalName: '',
            document: '',
            stateRegistration: '',
            address: '',
            city: '',
            state: '',
            zipCode: '',
            phone: '',
            email: '',
          },
    )
    setActiveSection('basic')
    setErrors({})
  }, [company, isOpen])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: formatFieldValue(name, value) }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = 'Nome é obrigatório'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent, closeAfterSave = false) => {
    e.preventDefault()
    if (!validateForm()) return
    setLoading(true)
    try {
      const companyId = formData.id || company?.id
      const mode = companyId ? 'update' : 'create'
      const url = companyId ? `/api/companies/${companyId}` : '/api/companies'
      const method = companyId ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          logo: formData.logo.trim(),
          name: formData.name.trim(),
          legalName: formData.legalName?.trim() ?? '',
          document: formData.document?.trim() ?? '',
          stateRegistration: formData.stateRegistration?.trim() ?? '',
          address: formData.address?.trim() ?? '',
          city: formData.city?.trim() ?? '',
          state: formData.state?.trim() ?? '',
          zipCode: formData.zipCode?.trim() ?? '',
          phone: formData.phone?.trim() ?? '',
          email: formData.email?.trim() ?? '',
        }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao salvar empresa')
      }
      const savedCompany = await response.json()
      setFormData((current) => ({
        ...current,
        ...savedCompany,
      }))
      await onSave(mode, savedCompany, { close: closeAfterSave })
    } catch (error) {
      setErrors({
        submit: error instanceof Error ? error.message : 'Erro ao salvar empresa',
      })
    } finally {
      setLoading(false)
    }
  }

  const inputClass = (field?: string) =>
    `w-full rounded-xl border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary ${
      field && errors[field] ? 'border-red-300' : 'border-border'
    }`

  const sectionButtonClass = (section: typeof activeSection) =>
    `rounded-xl px-4 py-2 text-sm font-semibold transition ${
      activeSection === section ? 'bg-primary text-white' : 'text-muted hover:bg-surface-secondary hover:text-foreground'
    }`

  return (
    <FormDrawer
      isOpen={isOpen}
      title={company?.id ? 'Editar Empresa' : 'Nova Empresa'}
      description='Configure os dados principais da empresa proprietaria dos empreendimentos.'
      onClose={onClose}
    >
      <form onSubmit={(event) => handleSubmit(event)} className='space-y-6'>
        {errors.submit && (
          <div className='rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>
            {errors.submit}
          </div>
        )}

        <div className='inline-flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1'>
          <button type='button' onClick={() => setActiveSection('basic')} className={sectionButtonClass('basic')}>Dados basicos</button>
          <button type='button' onClick={() => setActiveSection('legal')} className={sectionButtonClass('legal')}>Dados fiscais</button>
          <button type='button' onClick={() => setActiveSection('contact')} className={sectionButtonClass('contact')}>Contato e endereco</button>
        </div>

        <div className='grid gap-6'>
          {activeSection === 'basic' && (
            <>
              <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                <label className='mb-2 block text-sm font-semibold text-foreground'>Nome da Empresa *</label>
                <input
                  type='text'
                  name='name'
                  value={formData.name}
                  onChange={handleInputChange}
                  className={inputClass('name')}
                  placeholder='Oliveira Construcoes'
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
                  previewAlt={formData.name || 'Logo da empresa'}
                />
              </div>
            </>
          )}

          {activeSection === 'legal' && (
            <>
              <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                <label className='mb-2 block text-sm font-semibold text-foreground'>Razao social</label>
                <input name='legalName' value={formData.legalName ?? ''} onChange={handleInputChange} className={inputClass()} placeholder='Razao social completa' />
              </div>
              <div className='grid gap-4 md:grid-cols-2'>
                <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                  <label className='mb-2 block text-sm font-semibold text-foreground'>CNPJ</label>
                  <input name='document' value={formData.document ?? ''} onChange={handleInputChange} className={inputClass()} inputMode='numeric' placeholder='00.000.000/0001-00' />
                </div>
                <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                  <label className='mb-2 block text-sm font-semibold text-foreground'>Inscricao estadual</label>
                  <input name='stateRegistration' value={formData.stateRegistration ?? ''} onChange={handleInputChange} className={inputClass()} placeholder='Opcional' />
                </div>
              </div>
            </>
          )}

          {activeSection === 'contact' && (
            <>
              <div className='grid gap-4 md:grid-cols-2'>
                <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                  <label className='mb-2 block text-sm font-semibold text-foreground'>Email</label>
                  <input name='email' type='email' value={formData.email ?? ''} onChange={handleInputChange} className={inputClass()} placeholder='contato@empresa.com' />
                </div>
                <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                  <label className='mb-2 block text-sm font-semibold text-foreground'>Telefone</label>
                  <input name='phone' value={formData.phone ?? ''} onChange={handleInputChange} className={inputClass()} inputMode='tel' placeholder='(00) 00000-0000' />
                </div>
              </div>
              <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                <label className='mb-2 block text-sm font-semibold text-foreground'>Endereco</label>
                <textarea
                  name='address'
                  value={formData.address ?? ''}
                  onChange={(event) => setFormData((prev) => ({ ...prev, address: event.target.value }))}
                  rows={3}
                  className={inputClass()}
                  placeholder='Rua, numero, bairro e complemento'
                />
              </div>
              <div className='grid gap-4 md:grid-cols-3'>
                <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                  <label className='mb-2 block text-sm font-semibold text-foreground'>Cidade</label>
                  <input name='city' value={formData.city ?? ''} onChange={handleInputChange} className={inputClass()} placeholder='Cidade' />
                </div>
                <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                  <label className='mb-2 block text-sm font-semibold text-foreground'>UF</label>
                  <input name='state' value={formData.state ?? ''} onChange={handleInputChange} className={inputClass()} placeholder='BA' maxLength={2} />
                </div>
                <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                  <label className='mb-2 block text-sm font-semibold text-foreground'>CEP</label>
                  <input name='zipCode' value={formData.zipCode ?? ''} onChange={handleInputChange} className={inputClass()} inputMode='numeric' placeholder='00000-000' />
                </div>
              </div>
            </>
          )}
        </div>

        <div className='flex justify-end gap-3 border-t border-border pt-6'>
          <button type='button' onClick={onClose} disabled={loading} className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary disabled:opacity-50'>Cancelar</button>
          <button type='submit' disabled={loading} className='rounded-xl border border-primary bg-surface px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/8 disabled:opacity-50'>
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
          <button type='button' onClick={(event) => handleSubmit(event, true)} disabled={loading} className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-50'>
            {loading ? 'Salvando...' : 'Salvar e fechar'}
          </button>
        </div>
      </form>
    </FormDrawer>
  )
}
