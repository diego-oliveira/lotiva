'use client'

import { useEffect, useState } from 'react'
import DevelopmentForm from './components/DevelopmentForm'

interface Company {
  id: string
  name: string
}

interface Development {
  id: string
  name: string
  logo: string
  companyId: string
  createdAt: string
  company: Company
  _count?: {
    blocks: number
  }
}

export default function DevelopmentsPage() {
  const [developments, setDevelopments] = useState<Development[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingDevelopment, setEditingDevelopment] = useState<Development | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchDevelopments = async () => {
    const response = await fetch('/api/developments')
    if (!response.ok) throw new Error('Failed to fetch developments')
    const data = await response.json()
    setDevelopments(data)
  }

  const fetchCompanies = async () => {
    const response = await fetch('/api/companies')
    if (!response.ok) throw new Error('Failed to fetch companies')
    const data = await response.json()
    setCompanies(data)
  }

  const refresh = async () => {
    try {
      setLoading(true)
      await Promise.all([fetchDevelopments(), fetchCompanies()])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const filteredDevelopments = developments.filter((development) => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return development.name.toLowerCase().includes(searchLower) || development.company.name.toLowerCase().includes(searchLower)
  })

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR')
  const getInitials = (name: string) => name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2)

  if (loading) return <div className='animate-pulse'><div className='h-8 w-64 rounded-xl bg-surface-secondary'></div></div>
  if (error) return <div className='rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'>{error}</div>

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='page-title'>Empreendimentos</h1>
          <p className='page-subtitle'>Cadastre loteamentos e projetos ligados a uma empresa especifica.</p>
        </div>
        <div className='flex flex-wrap gap-3'>
          <button onClick={() => { setEditingDevelopment(null); setShowForm(true) }} disabled={companies.length === 0} className='rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-strong disabled:opacity-50'>Novo Empreendimento</button>
          <button onClick={() => void refresh()} className='rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'>Atualizar</button>
        </div>
      </div>

      <section className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]'>
        <div className='panel overflow-hidden'>
          <div className='panel-header flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between'>
            <div>
              <h2 className='text-lg font-semibold text-foreground'>{searchTerm ? `${filteredDevelopments.length} de ${developments.length} empreendimentos` : `Total de empreendimentos: ${developments.length}`}</h2>
              <p className='mt-1 text-sm text-muted'>Each development belongs to one company and can later own many blocks.</p>
            </div>
            <input type='text' placeholder='Buscar por empreendimento ou empresa...' value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className='block w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary md:max-w-xs' />
          </div>

          {companies.length === 0 && <div className='mx-6 mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'>Cadastre uma empresa antes de criar um empreendimento.</div>}

          <div className='overflow-x-auto'>
            <table className='min-w-full divide-y divide-border'>
              <thead className='bg-surface-secondary'>
                <tr>
                  <th className='table-head px-6 py-4 text-left'>Empreendimento</th>
                  <th className='table-head px-6 py-4 text-left'>Empresa</th>
                  <th className='table-head px-6 py-4 text-left'>Logo</th>
                  <th className='table-head px-6 py-4 text-left'>Blocos</th>
                  <th className='table-head px-6 py-4 text-left'>Criado em</th>
                  <th className='table-head px-6 py-4 text-right'>Acoes</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border bg-surface'>
                {filteredDevelopments.map((development) => (
                  <tr key={development.id} className='transition hover:bg-surface-secondary/70'>
                    <td className='px-6 py-4 whitespace-nowrap'><div className='flex items-center'><div className='flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white'>{getInitials(development.name)}</div><div className='ml-4'><div className='text-sm font-semibold text-foreground'>{development.name}</div><div className='text-sm text-muted'>{development.logo}</div></div></div></td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground'>{development.company.name}</td>
                    <td className='px-6 py-4 whitespace-nowrap'><img src={development.logo} alt={`Logo de ${development.name}`} className='h-12 w-24 rounded-2xl border border-border bg-background p-2 object-contain' /></td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground'><span className='rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700'>{development._count?.blocks ?? 0}</span></td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-muted'>{formatDate(development.createdAt)}</td>
                    <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-semibold'><button onClick={() => { setEditingDevelopment(development); setShowForm(true) }} className='rounded-xl px-3 py-2 text-primary transition hover:bg-primary/8'>Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className='panel'>
          <div className='panel-header px-6 py-5'>
            <h2 className='text-lg font-semibold text-foreground'>Business rules</h2>
            <p className='mt-1 text-sm text-muted'>This page now represents the empreendimento layer.</p>
          </div>
          <div className='space-y-4 px-6 py-6'>
            <div className='rounded-2xl border border-border bg-surface-secondary px-4 py-4'>
              <p className='text-sm font-semibold text-foreground'>Example</p>
              <p className='mt-2 text-sm leading-6 text-muted'>Loteamento Cajueiro I and Loteamento Cajueiro II can both belong to Oliveira Construcoes.</p>
            </div>
            <div className='rounded-2xl border border-border bg-surface-secondary px-4 py-4'>
              <p className='text-sm font-semibold text-foreground'>Follow-up</p>
              <p className='mt-2 text-sm leading-6 text-muted'>The next UI refactor should make block creation require a selected development.</p>
            </div>
          </div>
        </aside>
      </section>
      <DevelopmentForm development={editingDevelopment} companies={companies} isOpen={showForm} onClose={() => { setShowForm(false); setEditingDevelopment(null) }} onSave={async () => { await refresh(); setShowForm(false); setEditingDevelopment(null) }} />
    </div>
  )
}
