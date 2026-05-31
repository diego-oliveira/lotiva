'use client'

import { useEffect, useState } from 'react'
import FormDrawer from '@/app/components/FormDrawer'

interface Role {
  id: string
  name: string
}

interface Development {
  id: string
  name: string
}

interface MembershipRow {
  developmentId: string
  roleId: string
}

interface Client {
  id?: string
  name: string
  email: string
  cpf?: string | null
  rg?: string | null
  address?: string | null
  birthDate?: string | null
  profession?: string | null
  birthplace?: string | null
  maritalStatus?: string | null
  memberships?: {
    development: { id: string; name: string }
    roles: { role: { id: string; name: string } }[]
  }[]
}

interface ClientFormProps {
  client?: Client | null
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

const MARITAL_STATUS_OPTIONS = [
  { value: '', label: 'Selecione...' },
  { value: 'Solteiro', label: 'Solteiro(a)' },
  { value: 'Casado', label: 'Casado(a)' },
  { value: 'Divorciado', label: 'Divorciado(a)' },
  { value: 'Viuvo', label: 'Viuvo(a)' },
]

export default function ClientForm({ client, isOpen, onClose, onSave }: ClientFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  // optional legal fields
  const [cpf, setCpf] = useState('')
  const [rg, setRg] = useState('')
  const [address, setAddress] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [profession, setProfession] = useState('')
  const [birthplace, setBirthplace] = useState('')
  const [maritalStatus, setMaritalStatus] = useState('')
  const [showLegal, setShowLegal] = useState(false)

  // memberships
  const [memberships, setMemberships] = useState<MembershipRow[]>([])
  const [developments, setDevelopments] = useState<Development[]>([])
  const [roles, setRoles] = useState<Role[]>([])

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    fetch('/api/developments').then((r) => r.json()).then(setDevelopments).catch(() => {})
    fetch('/api/roles').then((r) => r.json()).then(setRoles).catch(() => {})
  }, [isOpen])

  useEffect(() => {
    if (client) {
      setName(client.name)
      setEmail(client.email)
      setCpf(client.cpf ?? '')
      setRg(client.rg ?? '')
      setAddress(client.address ?? '')
      setBirthDate(client.birthDate ? new Date(client.birthDate).toISOString().split('T')[0] : '')
      setProfession(client.profession ?? '')
      setBirthplace(client.birthplace ?? '')
      setMaritalStatus(client.maritalStatus ?? '')
      const hasLegal = !!(client.cpf || client.rg || client.address || client.birthDate)
      setShowLegal(hasLegal)
      setMemberships(
        (client.memberships ?? []).map((m) => ({
          developmentId: m.development.id,
          roleId: m.roles[0]?.role.id ?? '',
        })),
      )
    } else {
      setName('')
      setEmail('')
      setCpf('')
      setRg('')
      setAddress('')
      setBirthDate('')
      setProfession('')
      setBirthplace('')
      setMaritalStatus('')
      setShowLegal(false)
      setMemberships([])
    }
    setErrors({})
  }, [client, isOpen])

  const addMembership = () => {
    setMemberships((prev) => [...prev, { developmentId: '', roleId: '' }])
  }

  const removeMembership = (index: number) => {
    setMemberships((prev) => prev.filter((_, i) => i !== index))
  }

  const updateMembership = (index: number, field: keyof MembershipRow, value: string) => {
    setMemberships((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)))
  }

  const usedDevelopmentIds = (excludeIndex: number) =>
    memberships.filter((_, i) => i !== excludeIndex).map((m) => m.developmentId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'Nome e obrigatorio'
    if (!email.trim()) newErrors.email = 'Email e obrigatorio'
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Email invalido'

    for (let i = 0; i < memberships.length; i++) {
      if (!memberships[i].developmentId) newErrors[`m_dev_${i}`] = 'Selecione um empreendimento'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)
    try {
      const body = {
        name: name.trim(),
        email: email.trim(),
        cpf: cpf.trim() || null,
        rg: rg.trim() || null,
        address: address.trim() || null,
        birthDate: birthDate || null,
        profession: profession.trim() || null,
        birthplace: birthplace.trim() || null,
        maritalStatus: maritalStatus || null,
        memberships: memberships.filter((m) => m.developmentId),
      }

      const url = client?.id ? `/api/clients/${client.id}` : '/api/clients'
      const method = client?.id ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        let msg = 'Erro ao salvar usuario'
        try {
          const errorData = await response.json()
          msg = errorData.error || msg
        } catch {}
        throw new Error(msg)
      }

      onSave()
      onClose()
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : 'Erro ao salvar usuario' })
    } finally {
      setLoading(false)
    }
  }

  const fieldClass = (err?: string) =>
    `w-full rounded-xl border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary ${
      err ? 'border-red-300' : 'border-border'
    }`

  return (
    <FormDrawer
      isOpen={isOpen}
      title={client?.id ? 'Editar Usuario' : 'Novo Usuario'}
      description='Cadastre nome e email para criar o usuario. Dados legais e acessos podem ser adicionados agora ou depois.'
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className='space-y-6'>
        {errors.submit && (
          <div className='rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>
            {errors.submit}
          </div>
        )}

        {/* Basic fields */}
        <div className='space-y-4'>
          <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
            <label className='mb-2 block text-sm font-semibold text-foreground'>Nome Completo *</label>
            <input
              type='text'
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: '' })) }}
              className={fieldClass(errors.name)}
              placeholder='Digite o nome completo'
            />
            {errors.name && <p className='mt-2 text-sm text-red-600'>{errors.name}</p>}
          </div>

          <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
            <label className='mb-2 block text-sm font-semibold text-foreground'>Email *</label>
            <input
              type='email'
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '' })) }}
              className={fieldClass(errors.email)}
              placeholder='Digite o email'
            />
            {errors.email && <p className='mt-2 text-sm text-red-600'>{errors.email}</p>}
          </div>
        </div>

        {/* Memberships */}
        <div>
          <div className='mb-3 flex items-center justify-between'>
            <div>
              <p className='text-sm font-semibold text-foreground'>Acessos a empreendimentos</p>
              <p className='text-xs text-muted'>Opcional — pode ser configurado depois</p>
            </div>
            <button
              type='button'
              onClick={addMembership}
              className='rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-secondary'
            >
              + Adicionar
            </button>
          </div>

          {memberships.length === 0 && (
            <div className='rounded-2xl border border-dashed border-border px-5 py-4 text-center text-sm text-muted'>
              Nenhum acesso configurado
            </div>
          )}

          <div className='space-y-3'>
            {memberships.map((m, i) => (
              <div key={i} className='rounded-2xl border border-border bg-surface-secondary p-4'>
                <div className='flex items-start gap-3'>
                  <div className='flex-1 space-y-3'>
                    <div>
                      <label className='mb-1 block text-xs font-semibold text-foreground'>Empreendimento</label>
                      <select
                        value={m.developmentId}
                        onChange={(e) => { updateMembership(i, 'developmentId', e.target.value); setErrors((p) => ({ ...p, [`m_dev_${i}`]: '' })) }}
                        className={fieldClass(errors[`m_dev_${i}`])}
                      >
                        <option value=''>Selecione...</option>
                        {developments.map((d) => (
                          <option
                            key={d.id}
                            value={d.id}
                            disabled={usedDevelopmentIds(i).includes(d.id)}
                          >
                            {d.name}
                          </option>
                        ))}
                      </select>
                      {errors[`m_dev_${i}`] && <p className='mt-1 text-xs text-red-600'>{errors[`m_dev_${i}`]}</p>}
                    </div>

                    {roles.length > 0 && (
                      <div>
                        <label className='mb-1 block text-xs font-semibold text-foreground'>Funcao</label>
                        <select
                          value={m.roleId}
                          onChange={(e) => updateMembership(i, 'roleId', e.target.value)}
                          className={fieldClass()}
                        >
                          <option value=''>Sem funcao</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <button
                    type='button'
                    onClick={() => removeMembership(i)}
                    className='mt-6 rounded-xl p-2 text-muted transition hover:bg-red-50 hover:text-red-600'
                  >
                    <svg className='h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legal data (collapsible) */}
        <div>
          <button
            type='button'
            onClick={() => setShowLegal((v) => !v)}
            className='flex w-full items-center justify-between rounded-2xl border border-border bg-surface-secondary px-5 py-4 text-left transition hover:bg-surface-secondary/80'
          >
            <div>
              <p className='text-sm font-semibold text-foreground'>Dados legais para contrato</p>
              <p className='text-xs text-muted'>CPF, RG, endereco e outros — obrigatorios para gerar contratos de venda</p>
            </div>
            <svg
              className={`h-4 w-4 text-muted transition-transform ${showLegal ? 'rotate-180' : ''}`}
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
            </svg>
          </button>

          {showLegal && (
            <div className='mt-3 grid gap-4 md:grid-cols-2'>
              {[
                { label: 'CPF', value: cpf, set: setCpf, placeholder: '000.000.000-00', type: 'text' },
                { label: 'RG', value: rg, set: setRg, placeholder: 'Digite o RG', type: 'text' },
                { label: 'Data de Nascimento', value: birthDate, set: setBirthDate, placeholder: '', type: 'date' },
                { label: 'Profissao', value: profession, set: setProfession, placeholder: 'Digite a profissao', type: 'text' },
                { label: 'Local de Nascimento', value: birthplace, set: setBirthplace, placeholder: 'Cidade de nascimento', type: 'text' },
              ].map((f) => (
                <div key={f.label} className='rounded-2xl border border-border bg-surface-secondary p-5'>
                  <label className='mb-2 block text-sm font-semibold text-foreground'>{f.label}</label>
                  <input
                    type={f.type}
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    className={fieldClass()}
                    placeholder={f.placeholder}
                  />
                </div>
              ))}

              <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
                <label className='mb-2 block text-sm font-semibold text-foreground'>Estado Civil</label>
                <select
                  value={maritalStatus}
                  onChange={(e) => setMaritalStatus(e.target.value)}
                  className={fieldClass()}
                >
                  {MARITAL_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className='rounded-2xl border border-border bg-surface-secondary p-5 md:col-span-2'>
                <label className='mb-2 block text-sm font-semibold text-foreground'>Endereco</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  className={fieldClass()}
                  placeholder='Endereco completo'
                />
              </div>
            </div>
          )}
        </div>

        <div className='flex justify-end gap-3 border-t border-border pt-6'>
          <button
            type='button'
            onClick={onClose}
            disabled={loading}
            className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary disabled:opacity-50'
          >
            Cancelar
          </button>
          <button
            type='submit'
            disabled={loading}
            className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-50'
          >
            {loading ? 'Salvando...' : client?.id ? 'Atualizar Usuario' : 'Criar Usuario'}
          </button>
        </div>
      </form>
    </FormDrawer>
  )
}
