'use client'

import { useEffect, useState } from 'react'
import FormDrawer from '@/app/components/FormDrawer'
import ImageUploadField from '@/app/components/ImageUploadField'

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

export default function CompanyForm({
  company,
  isOpen,
  onClose,
  onSave,
}: CompanyFormProps) {
  const [formData, setFormData] = useState<Company>({ name: '', logo: '' })
  const [loading, setLoading] = useState(false)
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
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
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
              required
            />
          </div>
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
