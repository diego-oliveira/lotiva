'use client'

import { useEffect, useState } from 'react'
import FormDrawer from '@/app/components/FormDrawer'

interface Company {
  id?: string
  name: string
  logo: string
}

interface CompanyFormProps {
  company?: Company | null
  isOpen: boolean
  onClose: () => void
  onSave: (mode: 'create' | 'update') => void
}

function isValidLogoReference(value: string) {
  if (value.startsWith('/uploads/')) return true
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

export default function CompanyForm({
  company,
  isOpen,
  onClose,
  onSave,
}: CompanyFormProps) {
  const [formData, setFormData] = useState<Company>({ name: '', logo: '' })
  const [loading, setLoading] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    setFormData(
      company
        ? { id: company.id, name: company.name, logo: company.logo }
        : { name: '', logo: '' },
    )
    setErrors({})
  }, [company, isOpen])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = 'Nome é obrigatório'
    if (!formData.logo.trim()) newErrors.logo = 'Logo é obrigatória'
    if (formData.logo && !isValidLogoReference(formData.logo)) newErrors.logo = 'Informe uma URL valida ou envie uma imagem'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploadingLogo(true)
      setErrors((prev) => ({ ...prev, logo: '', submit: '' }))
      const payload = new FormData()
      payload.append('file', file)

      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: payload,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao enviar imagem')

      setFormData((prev) => ({ ...prev, logo: data.url }))
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        logo: error instanceof Error ? error.message : 'Erro ao enviar imagem',
      }))
    } finally {
      setUploadingLogo(false)
      e.target.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setLoading(true)
    try {
      const url = company?.id ? `/api/companies/${company.id}` : '/api/companies'
      const method = company?.id ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao salvar empresa')
      }
      onSave(company?.id ? 'update' : 'create')
      onClose()
    } catch (error) {
      setErrors({
        submit: error instanceof Error ? error.message : 'Erro ao salvar empresa',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <FormDrawer
      isOpen={isOpen}
      title={company?.id ? 'Editar Empresa' : 'Nova Empresa'}
      description='Configure os dados principais da empresa proprietaria dos empreendimentos.'
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className='space-y-6'>
        {errors.submit && (
          <div className='rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>
            {errors.submit}
          </div>
        )}

        <div className='grid gap-6'>
          <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
            <label className='mb-2 block text-sm font-semibold text-foreground'>Nome da Empresa *</label>
            <input
              type='text'
              name='name'
              value={formData.name}
              onChange={handleInputChange}
              className={`w-full rounded-xl border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary ${
                errors.name ? 'border-red-300' : 'border-border'
              }`}
              placeholder='Oliveira Construcoes'
            />
            {errors.name && <p className='mt-2 text-sm text-red-600'>{errors.name}</p>}
          </div>

          <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
            <label className='mb-2 block text-sm font-semibold text-foreground'>Logo *</label>
            <input
              type='text'
              name='logo'
              value={formData.logo}
              onChange={handleInputChange}
              className={`w-full rounded-xl border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary ${
                errors.logo ? 'border-red-300' : 'border-border'
              }`}
              placeholder='https://example.com/logo.png ou /uploads/logo.png'
            />
            <label className='mt-3 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'>
              {uploadingLogo ? 'Enviando imagem...' : 'Enviar imagem'}
              <input
                type='file'
                accept='image/png,image/jpeg,image/webp'
                className='sr-only'
                disabled={uploadingLogo}
                onChange={handleLogoUpload}
              />
            </label>
            {errors.logo && <p className='mt-2 text-sm text-red-600'>{errors.logo}</p>}
          </div>

          {formData.logo && !errors.logo && (
            <div className='rounded-2xl border border-border bg-surface p-5'>
              <p className='text-sm font-semibold text-foreground'>Pre-visualizacao</p>
              <div className='mt-4 rounded-2xl border border-dashed border-border bg-surface-secondary p-6'>
                <img src={formData.logo} alt={formData.name || 'Logo da empresa'} className='h-20 max-w-full object-contain' />
              </div>
            </div>
          )}
        </div>

        <div className='flex justify-end gap-3 border-t border-border pt-6'>
          <button type='button' onClick={onClose} disabled={loading} className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary disabled:opacity-50'>Cancelar</button>
          <button type='submit' disabled={loading} className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-50'>
            {loading ? 'Salvando...' : company?.id ? 'Atualizar Empresa' : 'Criar Empresa'}
          </button>
        </div>
      </form>
    </FormDrawer>
  )
}
