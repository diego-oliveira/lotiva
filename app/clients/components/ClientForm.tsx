'use client'

import { useState, useEffect } from 'react'

interface Client {
  id?: string
  name: string
  cpf: string
  email: string
  address: string
  birthDate: string
  rg: string
  profession: string
  birthplace: string
  maritalStatus: string
}

interface ClientFormProps {
  client?: Client | null
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

const MARITAL_STATUS_OPTIONS = [
  { value: 'Solteiro', label: 'Solteiro(a)' },
  { value: 'Casado', label: 'Casado(a)' },
  { value: 'Divorciado', label: 'Divorciado(a)' },
  { value: 'Viúvo', label: 'Viúvo(a)' },
]

export default function ClientForm({ client, isOpen, onClose, onSave }: ClientFormProps) {
  const [formData, setFormData] = useState<Client>({
    name: '',
    cpf: '',
    email: '',
    address: '',
    birthDate: '',
    rg: '',
    profession: '',
    birthplace: '',
    maritalStatus: 'Solteiro',
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (client) {
      setFormData({
        ...client,
        birthDate: client.birthDate ? new Date(client.birthDate).toISOString().split('T')[0] : '',
      })
    } else {
      setFormData({
        name: '',
        cpf: '',
        email: '',
        address: '',
        birthDate: '',
        rg: '',
        profession: '',
        birthplace: '',
        maritalStatus: 'Solteiro',
      })
    }
    setErrors({})
  }, [client, isOpen])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) newErrors.name = 'Nome é obrigatório'
    if (!formData.cpf.trim()) newErrors.cpf = 'CPF é obrigatório'
    if (!formData.email.trim()) newErrors.email = 'Email é obrigatório'
    if (!formData.address.trim()) newErrors.address = 'Endereço é obrigatório'
    if (!formData.birthDate) newErrors.birthDate = 'Data de nascimento é obrigatória'
    if (!formData.rg.trim()) newErrors.rg = 'RG é obrigatório'
    if (!formData.profession.trim()) newErrors.profession = 'Profissão é obrigatória'
    if (!formData.birthplace.trim()) newErrors.birthplace = 'Local de nascimento é obrigatório'

    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email inválido'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setLoading(true)
    try {
      const url = client?.id ? `/api/clients/${client.id}` : '/api/clients'
      const method = client?.id ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao salvar cliente')
      }

      onSave()
      onClose()
    } catch (error) {
      console.error('Error saving client:', error)
      setErrors({ submit: error instanceof Error ? error.message : 'Erro ao salvar cliente' })
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl bg-white dark:bg-gray-800 rounded-md shadow-lg">
        <div className="flex items-center justify-between pb-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {client?.id ? 'Editar Cliente' : 'Novo Cliente'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.submit && (
            <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded-md p-4">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nome Completo *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.name ? 'border-red-300 dark:border-red-600' : 'border-gray-300'
                }`}
                placeholder="Digite o nome completo"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.email ? 'border-red-300 dark:border-red-600' : 'border-gray-300'
                }`}
                placeholder="Digite o email"
              />
              {errors.email && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                CPF *
              </label>
              <input
                type="text"
                name="cpf"
                value={formData.cpf}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.cpf ? 'border-red-300 dark:border-red-600' : 'border-gray-300'
                }`}
                placeholder="000.000.000-00"
              />
              {errors.cpf && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.cpf}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                RG *
              </label>
              <input
                type="text"
                name="rg"
                value={formData.rg}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.rg ? 'border-red-300 dark:border-red-600' : 'border-gray-300'
                }`}
                placeholder="Digite o RG"
              />
              {errors.rg && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.rg}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data de Nascimento *
              </label>
              <input
                type="date"
                name="birthDate"
                value={formData.birthDate}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.birthDate ? 'border-red-300 dark:border-red-600' : 'border-gray-300'
                }`}
              />
              {errors.birthDate && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.birthDate}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Estado Civil *
              </label>
              <select
                name="maritalStatus"
                value={formData.maritalStatus}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                {MARITAL_STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Profissão *
              </label>
              <input
                type="text"
                name="profession"
                value={formData.profession}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.profession ? 'border-red-300 dark:border-red-600' : 'border-gray-300'
                }`}
                placeholder="Digite a profissão"
              />
              {errors.profession && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.profession}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Local de Nascimento *
              </label>
              <input
                type="text"
                name="birthplace"
                value={formData.birthplace}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.birthplace ? 'border-red-300 dark:border-red-600' : 'border-gray-300'
                }`}
                placeholder="Digite o local de nascimento"
              />
              {errors.birthplace && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.birthplace}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Endereço *
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              rows={3}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                errors.address ? 'border-red-300 dark:border-red-600' : 'border-gray-300'
              }`}
              placeholder="Digite o endereço completo"
            />
            {errors.address && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.address}</p>}
          </div>

          <div className="flex items-center justify-end pt-4 space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvando...' : client?.id ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}