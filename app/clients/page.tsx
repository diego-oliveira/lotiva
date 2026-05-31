'use client'

import { useEffect, useState } from 'react'
import ClientForm from './components/ClientForm'
import ClientProfileDrawer from './components/ClientProfileDrawer'
import DeleteConfirmModal from './components/DeleteConfirmModal'

interface Membership {
  id: string
  development: { id: string; name: string }
  roles: { role: { id: string; name: string } }[]
}

interface Client {
  id: string
  name: string
  email: string
  cpf?: string | null
  rg?: string | null
  address?: string | null
  birthDate?: string | null
  profession?: string | null
  birthplace?: string | null
  maritalStatus?: string | null
  memberships: Membership[]
  createdAt: string
  updatedAt: string
}

function profileComplete(c: Client) {
  return !!(c.cpf && c.rg && c.address && c.birthDate && c.profession && c.birthplace && c.maritalStatus)
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingClient, setDeletingClient] = useState<Client | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => { fetchClients() }, [])

  const fetchClients = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/clients')
      if (!res.ok) throw new Error('Failed to fetch clients')
      setClients(await res.json())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const confirmDelete = async () => {
    if (!deletingClient) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/clients/${deletingClient.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete client')
      await fetchClients()
      setShowDeleteModal(false)
      setDeletingClient(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir cliente')
    } finally {
      setDeleteLoading(false)
    }
  }

  const filteredClients = clients.filter((c) => {
    if (!searchTerm) return true
    const q = searchTerm.toLowerCase()
    const digits = searchTerm.replace(/\D/g, '')
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (digits && c.cpf?.replace(/\D/g, '').includes(digits))
    )
  })

  if (loading) return <div className='animate-pulse'><div className='h-8 w-56 rounded-xl bg-surface-secondary' /></div>
  if (error) return <div className='rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700'>{error}</div>

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='page-title'>Usuarios</h1>
          <p className='page-subtitle'>Gerencie pessoas, acessos a empreendimentos e dados cadastrais para contratos.</p>
        </div>
        <button
          onClick={() => { setEditingClient(null); setShowForm(true) }}
          className='rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-strong'
        >
          Novo Usuario
        </button>
      </div>

      <div className='panel overflow-hidden'>
        <div className='panel-header flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between'>
          <h2 className='text-lg font-semibold text-foreground'>
            {searchTerm
              ? `${filteredClients.length} de ${clients.length} usuarios`
              : `Total de usuarios: ${clients.length}`}
          </h2>
          <div className='relative w-full md:max-w-xs'>
            <input
              type='text'
              placeholder='Buscar por nome, email ou CPF...'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className='block w-full rounded-2xl border border-border bg-background px-4 py-3 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary'
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className='absolute inset-y-0 right-3 my-auto h-5 text-muted transition hover:text-foreground'
              >
                <svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M6 18L18 6M6 6l12 12' />
                </svg>
              </button>
            )}
          </div>
        </div>

        {filteredClients.length === 0 ? (
          <div className='px-6 py-12 text-center'>
            <div className='mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-secondary text-muted'>
              <svg className='h-7 w-7' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.8} d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' />
              </svg>
            </div>
            <h3 className='mt-4 text-base font-semibold text-foreground'>
              {searchTerm ? 'Nenhum usuario encontrado' : 'Nenhum usuario cadastrado'}
            </h3>
            <p className='mt-2 text-sm text-muted'>
              {searchTerm
                ? <>Nenhum resultado para "<span className='font-medium'>{searchTerm}</span>".</>
                : 'Comece adicionando um novo usuario ao sistema.'}
            </p>
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='min-w-full divide-y divide-border'>
              <thead className='bg-surface-secondary'>
                <tr>
                  <th className='table-head px-6 py-4 text-left'>Usuario</th>
                  <th className='table-head px-6 py-4 text-left'>Empreendimentos</th>
                  <th className='table-head px-6 py-4 text-left'>Perfil contrato</th>
                  <th className='table-head px-6 py-4 text-left'>Cadastro</th>
                  <th className='table-head px-6 py-4 text-right'>Acoes</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border bg-surface'>
                {filteredClients.map((client) => {
                  const complete = profileComplete(client)
                  return (
                    <tr key={client.id} className='transition hover:bg-surface-secondary/70'>
                      <td className='px-6 py-4 whitespace-nowrap'>
                        <div className='flex items-center gap-4'>
                          <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white'>
                            {getInitials(client.name)}
                          </div>
                          <div>
                            <div className='text-sm font-semibold text-foreground'>{client.name}</div>
                            <div className='text-sm text-muted'>{client.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className='px-6 py-4'>
                        {client.memberships.length === 0 ? (
                          <span className='text-sm text-muted'>Sem acesso</span>
                        ) : (
                          <div className='flex flex-wrap gap-1'>
                            {client.memberships.map((m) => (
                              <span
                                key={m.id}
                                className='inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary'
                                title={m.roles.map((r) => r.role.name).join(', ')}
                              >
                                {m.development.name}
                                {m.roles[0] && (
                                  <span className='ml-1 text-primary/60'>· {m.roles[0].role.name}</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className='px-6 py-4 whitespace-nowrap'>
                        {complete ? (
                          <span className='inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700'>
                            <svg className='h-3 w-3' fill='currentColor' viewBox='0 0 20 20'>
                              <path fillRule='evenodd' d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' clipRule='evenodd' />
                            </svg>
                            Completo
                          </span>
                        ) : (
                          <span className='inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700'>
                            <svg className='h-3 w-3' fill='currentColor' viewBox='0 0 20 20'>
                              <path fillRule='evenodd' d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z' clipRule='evenodd' />
                            </svg>
                            Incompleto
                          </span>
                        )}
                      </td>

                      <td className='px-6 py-4 whitespace-nowrap text-sm text-muted'>
                        {new Date(client.createdAt).toLocaleDateString('pt-BR')}
                      </td>

                      <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-semibold'>
                        <div className='flex items-center justify-end gap-2'>
                          <button
                            onClick={() => { setSelectedClientId(client.id); setShowProfile(true) }}
                            className='rounded-xl px-3 py-2 text-primary transition hover:bg-primary/8'
                          >
                            Ver ficha
                          </button>
                          <button
                            onClick={() => { setEditingClient(client); setShowForm(true) }}
                            className='rounded-xl px-3 py-2 text-primary transition hover:bg-primary/8'
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => { setDeletingClient(client); setShowDeleteModal(true) }}
                            className='rounded-xl px-3 py-2 text-red-600 transition hover:bg-red-50'
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ClientForm
        client={editingClient}
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingClient(null) }}
        onSave={() => { fetchClients(); setShowForm(false); setEditingClient(null) }}
      />

      <ClientProfileDrawer
        clientId={selectedClientId}
        isOpen={showProfile}
        onClose={() => { setShowProfile(false); setSelectedClientId(null) }}
        onEdit={(client) => {
          setEditingClient(client)
          setShowForm(true)
        }}
      />

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        clientName={deletingClient?.name ?? ''}
        onClose={() => { setShowDeleteModal(false); setDeletingClient(null) }}
        onConfirm={confirmDelete}
        loading={deleteLoading}
      />
    </div>
  )
}
