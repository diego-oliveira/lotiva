'use client'

import { useEffect, useState } from 'react'

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
  onSave: () => void
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
      onSave()
      onClose()
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : 'Erro ao salvar empreendimento' })
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className='fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50'>
      <div className='relative top-20 mx-auto p-5 border w-full max-w-2xl bg-white dark:bg-gray-800 rounded-md shadow-lg'>
        <div className='flex items-center justify-between pb-3'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>{development?.id ? 'Editar Empreendimento' : 'Novo Empreendimento'}</h3>
          <button onClick={onClose} className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'>
            <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M6 18L18 6M6 6l12 12'></path></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className='space-y-4'>
          {errors.submit && <div className='bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded-md p-4'><p className='text-sm text-red-600 dark:text-red-400'>{errors.submit}</p></div>}
          <div className='grid grid-cols-1 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>Empresa *</label>
              <select name='companyId' value={formData.companyId} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${errors.companyId ? 'border-red-300 dark:border-red-600' : 'border-gray-300'}`}>
                <option value=''>Selecione uma empresa</option>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
              {errors.companyId && <p className='mt-1 text-sm text-red-600 dark:text-red-400'>{errors.companyId}</p>}
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>Nome do Empreendimento *</label>
              <input type='text' name='name' value={formData.name} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${errors.name ? 'border-red-300 dark:border-red-600' : 'border-gray-300'}`} placeholder='Loteamento Cajueiro I' />
              {errors.name && <p className='mt-1 text-sm text-red-600 dark:text-red-400'>{errors.name}</p>}
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>URL do Logo *</label>
              <input type='url' name='logo' value={formData.logo} onChange={handleInputChange} className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${errors.logo ? 'border-red-300 dark:border-red-600' : 'border-gray-300'}`} placeholder='https://example.com/logo.png' />
              {errors.logo && <p className='mt-1 text-sm text-red-600 dark:text-red-400'>{errors.logo}</p>}
            </div>
            {formData.logo && !errors.logo && <div className='rounded-lg border border-gray-200 dark:border-gray-700 p-4'><p className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>Pré-visualização</p><img src={formData.logo} alt={formData.name || 'Logo do empreendimento'} className='h-20 max-w-full object-contain' /></div>}
          </div>
          <div className='flex justify-end space-x-3 pt-4'>
            <button type='button' onClick={onClose} disabled={loading} className='px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600 disabled:opacity-50'>Cancelar</button>
            <button type='submit' disabled={loading} className='px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50'>{loading ? 'Salvando...' : development?.id ? 'Atualizar Empreendimento' : 'Criar Empreendimento'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
