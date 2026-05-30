'use client'

import { useEffect, useState } from 'react'
import FormDrawer from '@/app/components/FormDrawer'

interface Company {
  id: string
  name: string
}

interface Development {
  id?: string
  name: string
  logo: string
  companyId: string
}

interface DevelopmentFormProps {
  development?: Development | null
  companies: Company[]
  isOpen: boolean
  onClose: () => void
  onSave: (mode: 'create' | 'update') => void
}

export default function DevelopmentForm({
  development,
  companies,
  isOpen,
  onClose,
  onSave,
}: DevelopmentFormProps) {
  const [formData, setFormData] = useState<Development>({ name: '', logo: '', companyId: '' })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    setFormData(
      development
        ? { id: development.id, name: development.name, logo: development.logo, companyId: development.companyId }
        : { name: '', logo: '', companyId: companies[0]?.id ?? '' },
    )
    setErrors({})
  }, [development, isOpen, companies])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = 'Nome é obrigatório'
    if (!formData.companyId) newErrors.companyId = 'Selecione uma empresa'
    if (!formData.logo.trim()) newErrors.logo = 'Logo é obrigatória'
    if (formData.logo) {
      try {
        new URL(formData.logo)
      } catch {
        newErrors.logo = 'Informe uma URL válida'
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setLoading(true)
    try {
      const url = development?.id ? `/api/developments/${development.id}` : '/api/developments'
      const method = development?.id ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao salvar empreendimento')
      }
      onSave(development?.id ? 'update' : 'create')
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
      title={development?.id ? 'Editar Empreendimento' : 'Novo Empreendimento'}
      description='Defina a empresa proprietaria e os dados visuais principais do empreendimento.'
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
            <label className='mb-2 block text-sm font-semibold text-foreground'>URL do Logo *</label>
            <input
              type='url'
              name='logo'
              value={formData.logo}
              onChange={handleInputChange}
              className={`w-full rounded-xl border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary ${
                errors.logo ? 'border-red-300' : 'border-border'
              }`}
              placeholder='https://example.com/logo.png'
            />
            {errors.logo && <p className='mt-2 text-sm text-red-600'>{errors.logo}</p>}
          </div>

          {formData.logo && !errors.logo && (
            <div className='rounded-2xl border border-border bg-surface p-5'>
              <p className='text-sm font-semibold text-foreground'>Pre-visualizacao</p>
              <div className='mt-4 rounded-2xl border border-dashed border-border bg-surface-secondary p-6'>
                <img src={formData.logo} alt={formData.name || 'Logo do empreendimento'} className='h-20 max-w-full object-contain' />
              </div>
            </div>
          )}
        </div>

        <div className='flex justify-end gap-3 border-t border-border pt-6'>
          <button type='button' onClick={onClose} disabled={loading} className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary disabled:opacity-50'>Cancelar</button>
          <button type='submit' disabled={loading} className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-50'>
            {loading ? 'Salvando...' : development?.id ? 'Atualizar Empreendimento' : 'Criar Empreendimento'}
          </button>
        </div>
      </form>
    </FormDrawer>
  )
}
