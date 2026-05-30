'use client'

import { useEffect, useState } from 'react'
import CompanyForm from './components/CompanyForm'
import InlineAlert from '@/app/components/InlineAlert'

interface Company {
  id: string
  name: string
  logo: string
  createdAt: string
  _count?: {
    developments: number
  }
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchCompanies()
  }, [])

  useEffect(() => {
    if (!successMessage) return
    const timeout = setTimeout(() => setSuccessMessage(null), 4000)
    return () => clearTimeout(timeout)
  }, [successMessage])

  const fetchCompanies = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/companies')
      if (!response.ok) throw new Error('Failed to fetch companies')
      setCompanies(await response.json())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const filteredCompanies = companies.filter((company) =>
    !searchTerm || company.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('pt-BR')

  const getInitials = (name: string) =>
    name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2)

  if (loading) return <div className='animate-pulse'><div className='h-8 w-56 rounded-xl bg-surface-secondary'></div></div>
  if (error) return <div className='rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700'>{error}</div>

  return (
    <div className='space-y-6'>
      {successMessage && (
        <InlineAlert
          variant='success'
          title='Operacao realizada com sucesso'
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}

      <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='page-title'>Empresas</h1>
          <p className='page-subtitle'>Cadastre os grupos e construtoras que serao proprietarios dos empreendimentos.</p>
        </div>
        <div className='flex flex-wrap gap-3'>
          <button onClick={() => { setEditingCompany(null); setShowForm(true) }} className='rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-strong'>Nova Empresa</button>
        </div>
      </div>

      <section className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]'>
        <div className='panel overflow-hidden'>
          <div className='panel-header flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between'>
            <div>
              <h2 className='text-lg font-semibold text-foreground'>{searchTerm ? `${filteredCompanies.length} de ${companies.length} empresas` : `Total de empresas: ${companies.length}`}</h2>
              <p className='mt-1 text-sm text-muted'>Mantenha a base juridica organizada antes de cadastrar empreendimentos.</p>
            </div>
            <input type='text' placeholder='Buscar por nome da empresa...' value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className='block w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary md:max-w-xs' />
          </div>

          <div className='overflow-x-auto'>
            <table className='min-w-full divide-y divide-border'>
              <thead className='bg-surface-secondary'>
                <tr>
                  <th className='table-head px-6 py-4 text-left'>Empresa</th>
                  <th className='table-head px-6 py-4 text-left'>Logo</th>
                  <th className='table-head px-6 py-4 text-left'>Empreendimentos</th>
                  <th className='table-head px-6 py-4 text-left'>Criada em</th>
                  <th className='table-head px-6 py-4 text-right'>Acoes</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border bg-surface'>
                {filteredCompanies.map((company) => (
                  <tr key={company.id} className='transition hover:bg-surface-secondary/70'>
                    <td className='px-6 py-4 whitespace-nowrap'><div className='flex items-center'><div className='flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white'>{getInitials(company.name)}</div><div className='ml-4'><div className='text-sm font-semibold text-foreground'>{company.name}</div><div className='text-sm text-muted'>{company.logo}</div></div></div></td>
                    <td className='px-6 py-4 whitespace-nowrap'><img src={company.logo} alt={`Logo de ${company.name}`} className='h-12 w-24 rounded-2xl border border-border bg-background p-2 object-contain' /></td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground'><span className='rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700'>{company._count?.developments ?? 0}</span></td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-muted'>{formatDate(company.createdAt)}</td>
                    <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-semibold'><button onClick={() => { setEditingCompany(company); setShowForm(true) }} className='rounded-xl px-3 py-2 text-primary transition hover:bg-primary/8'>Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className='panel'>
          <div className='panel-header px-6 py-5'>
            <h2 className='text-lg font-semibold text-foreground'>How it maps</h2>
            <p className='mt-1 text-sm text-muted'>Empresa is the legal owner above every empreendimento.</p>
          </div>
          <div className='space-y-4 px-6 py-6'>
            <div className='rounded-2xl border border-border bg-surface-secondary px-4 py-4'>
              <p className='text-sm font-semibold text-foreground'>Example</p>
              <p className='mt-2 text-sm leading-6 text-muted'>Oliveira Construcoes can contain multiple developments like Loteamento Cajueiro I and II.</p>
            </div>
            <div className='rounded-2xl border border-border bg-surface-secondary px-4 py-4'>
              <p className='text-sm font-semibold text-foreground'>Next linkage</p>
              <p className='mt-2 text-sm leading-6 text-muted'>Blocks should be attached to a development, not directly to the company.</p>
            </div>
          </div>
        </aside>
      </section>
      <CompanyForm
        company={editingCompany}
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingCompany(null) }}
        onSave={async (mode) => {
          await fetchCompanies()
          setShowForm(false)
          setEditingCompany(null)
          setSuccessMessage(
            mode === 'create'
              ? 'A empresa foi criada com sucesso.'
              : 'A empresa foi atualizada com sucesso.',
          )
        }}
      />
    </div>
  )
}
