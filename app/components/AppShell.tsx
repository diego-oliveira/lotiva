'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type NavItem = {
  href: string
  label: string
  description: string
  icon: 'dashboard' | 'setup' | 'company' | 'development' | 'document' | 'user' | 'lot' | 'sale' | 'finance'
  permission?: 'admin' | 'manageSettings' | 'manageUsers' | 'sales' | 'finance'
}

type PermissionMap = {
  admin: boolean
  manageSettings: boolean
  manageUsers: boolean
  sales: boolean
  finance: boolean
}

type CurrentUser = {
  id: string
  name?: string | null
  email: string
}

type Notification = {
  id: string
  title: string
  message: string
  href?: string | null
  readAt?: string | null
  createdAt: string
}

const navItems: NavItem[] = [
  {
    href: '/',
    label: 'Painel',
    description: 'Indicadores gerais',
    icon: 'dashboard',
  },
  {
    href: '/onboarding',
    label: 'Cadastro inicial',
    description: 'Cadastro guiado',
    icon: 'setup',
    permission: 'manageSettings',
  },
  {
    href: '/companies',
    label: 'Empresas',
    description: 'Proprietarias',
    icon: 'company',
    permission: 'manageSettings',
  },
  {
    href: '/developments',
    label: 'Empreendimentos',
    description: 'Loteamentos',
    icon: 'development',
    permission: 'manageSettings',
  },
  {
    href: '/document-templates',
    label: 'Modelos',
    description: 'Documentos e contratos',
    icon: 'document',
    permission: 'manageSettings',
  },
  {
    href: '/clients',
    label: 'Pessoas',
    description: 'Clientes e equipe',
    icon: 'user',
    permission: 'manageUsers',
  },
  {
    href: '/lots',
    label: 'Lotes',
    description: 'Estoque comercial',
    icon: 'lot',
    permission: 'sales',
  },
  {
    href: '/proposals',
    label: 'Propostas',
    description: 'Aprovacoes comerciais',
    icon: 'sale',
    permission: 'sales',
  },
  {
    href: '/sales',
    label: 'Vendas',
    description: 'Contratos',
    icon: 'sale',
    permission: 'sales',
  },
  {
    href: '/finance',
    label: 'Financeiro',
    description: 'Recebimentos',
    icon: 'finance',
    permission: 'finance',
  },
]

function NavIcon({ icon }: { icon: NavItem['icon'] }) {
  const className = 'h-5 w-5'

  switch (icon) {
    case 'setup':
      return (
        <svg className={className} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M9 12.75l2 2 4-5.5M5 5.5h14M7 5.5v13h10v-13M8.5 9h1M8.5 15h1' />
        </svg>
      )
    case 'company':
      return (
        <svg className={className} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M4 21h16M7 21V7l5-3 5 3v14M9 11h.01M9 15h.01M12 11h.01M12 15h.01M15 11h.01M15 15h.01' />
        </svg>
      )
    case 'development':
      return (
        <svg className={className} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M3 20h18M6 20V10l6-4 6 4v10M9 20v-4h6v4' />
        </svg>
      )
    case 'document':
      return (
        <svg className={className} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M7 3.75h7l3 3V20.25H7zM14 3.75v3h3M9.5 11h5M9.5 14.5h5M9.5 18h3' />
        </svg>
      )
    case 'user':
      return (
        <svg className={className} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 19.5a7.5 7.5 0 0115 0' />
        </svg>
      )
    case 'lot':
      return (
        <svg className={className} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M4 6h16v12H4zM8 6v12M16 6v12M4 10h16M4 14h16' />
        </svg>
      )
    case 'sale':
      return (
        <svg className={className} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-10v12M4 12a8 8 0 1016 0 8 8 0 10-16 0z' />
        </svg>
      )
    case 'finance':
      return (
        <svg className={className} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M4 7h16M6 11h12M8 15h4M6 19h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z' />
        </svg>
      )
    default:
      return (
        <svg className={className} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M4 13h7V4H4v9zm9 7h7v-7h-7v7zm0-16v5h7V4h-7zM4 20h7v-5H4v5z' />
        </svg>
      )
  }
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [permissions, setPermissions] = useState<PermissionMap | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [accessChecked, setAccessChecked] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const isAuthPage = pathname.startsWith('/signin') || pathname.startsWith('/auth')

  useEffect(() => {
    if (isAuthPage) {
      setAccessChecked(true)
      return
    }

    setAccessChecked(false)
    fetch('/api/me/permissions', { cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 403) {
          await signOut({ callbackUrl: '/signin?error=AccessDenied' })
          return null
        }

        if (!response.ok) {
          window.location.replace('/signin?error=SessionRequired')
          return null
        }

        return response.json()
      })
      .then((payload) => {
        if (!payload) return
        setPermissions(payload?.permissions ?? null)
        setCurrentUser(payload?.user ?? null)
        setAccessChecked(true)
      })
      .catch(() => {
        setPermissions(null)
        setCurrentUser(null)
        window.location.replace('/signin?error=SessionRequired')
      })
  }, [isAuthPage])

  useEffect(() => {
    if (isAuthPage || !accessChecked || !currentUser) return

    const fetchNotifications = () => {
      fetch('/api/notifications', { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : []))
        .then((payload) => setNotifications(Array.isArray(payload) ? payload : []))
        .catch(() => setNotifications([]))
    }

    fetchNotifications()
    const interval = window.setInterval(fetchNotifications, 60000)
    return () => window.clearInterval(interval)
  }, [accessChecked, currentUser, isAuthPage, pathname])

  useEffect(() => {
    setUserMenuOpen(false)
    setNotificationsOpen(false)
  }, [pathname])

  const unreadNotifications = notifications.filter((notification) => !notification.readAt).length

  const markNotificationRead = async (notification: Notification) => {
    if (notification.readAt) return
    setNotifications((current) => current.map((item) => (
      item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item
    )))
    await fetch(`/api/notifications/${notification.id}`, { method: 'PATCH' }).catch(() => undefined)
  }

  const visibleNavItems = useMemo(() => {
    if (!permissions) return navItems
    const salesOnly =
      permissions.sales &&
      !permissions.admin &&
      !permissions.manageSettings &&
      !permissions.manageUsers &&
      !permissions.finance
    return navItems.filter((item) => {
      if (salesOnly && item.href === '/') return false
      return !item.permission || permissions[item.permission]
    })
  }, [permissions])

  if (isAuthPage) {
    return <>{children}</>
  }

  if (!accessChecked || !currentUser || !permissions) {
    return (
      <main className='flex min-h-screen items-center justify-center bg-background'>
        <p className='text-sm font-medium text-muted'>Validando acesso...</p>
      </main>
    )
  }

  return (
    <div className='min-h-screen bg-background text-foreground'>
      <div className='flex min-h-screen'>
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[290px] transform bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className='flex h-[88px] items-center justify-between border-b border-white/10 px-6'>
            <div className='flex items-center gap-3'>
              <div className='flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-base font-bold text-white shadow-lg shadow-primary/20'>
                L
              </div>
              <div>
                <p className='text-xs font-semibold uppercase tracking-[0.24em] text-slate-400'>Lotiva</p>
                <h1 className='mt-1 text-[19px] font-semibold text-white'>Loteamentos</h1>
              </div>
            </div>
            <button
              type='button'
              onClick={() => setSidebarOpen(false)}
              className='rounded-lg p-2 text-slate-400 hover:bg-sidebar-active hover:text-white lg:hidden'
            >
              <svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M6 18L18 6M6 6l12 12' />
              </svg>
            </button>
          </div>

          <div className='px-5 py-6'>
            <p className='mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500'>Menu</p>
            <nav className='space-y-1.5'>
              {visibleNavItems.map((item) => {
                const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
                      isActive
                        ? 'bg-sidebar-active text-white'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className={`rounded-lg p-2 ${isActive ? 'bg-white/10 text-white' : 'bg-white/5 text-slate-300'}`}>
                      <NavIcon icon={item.icon} />
                    </span>
                    <span className='min-w-0'>
                      <span className='block text-sm font-semibold'>{item.label}</span>
                      <span className={`block truncate text-xs ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                        {item.description}
                      </span>
                    </span>
                  </Link>
                )
              })}
            </nav>
            <button
              type='button'
              onClick={() => signOut({ callbackUrl: '/signin' })}
              className='mt-6 flex w-full items-center justify-center rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white md:hidden'
            >
              Sair
            </button>
          </div>
        </aside>

        <div className='flex min-h-screen min-w-0 flex-1 flex-col'>
          <header className='sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur'>
            <div className='flex h-[88px] items-center justify-between px-4 sm:px-6 lg:px-8'>
              <div className='flex items-center gap-4'>
                <button
                  type='button'
                  onClick={() => setSidebarOpen(true)}
                  className='rounded-xl border border-border bg-surface p-2 text-foreground lg:hidden'
                >
                  <svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M4 6h16M4 12h16M4 18h16' />
                  </svg>
                </button>

                <div>
                  <p className='text-xs font-semibold uppercase tracking-[0.2em] text-muted'>Lotiva</p>
                  <p className='mt-1 text-sm font-medium text-foreground'>Gestao comercial de loteamentos</p>
                </div>
              </div>

              <div className='flex items-center gap-4'>
                <div className='relative'>
                  <button
                    type='button'
                    onClick={() => {
                      setNotificationsOpen((current) => !current)
                      setUserMenuOpen(false)
                    }}
                    className='relative rounded-xl border border-border bg-surface p-3 text-foreground shadow-sm transition hover:bg-surface-secondary'
                    aria-label='Notificacoes'
                    aria-expanded={notificationsOpen}
                  >
                    <svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M14.857 17.082A23.85 23.85 0 0118 18c-1.5-1.75-2.25-4-2.25-6.75a3.75 3.75 0 10-7.5 0C8.25 14 7.5 16.25 6 18a23.85 23.85 0 013.143-.918M14.857 17.082a3 3 0 11-5.714 0' />
                    </svg>
                    {unreadNotifications > 0 && (
                      <span className='absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white'>
                        {unreadNotifications > 9 ? '9+' : unreadNotifications}
                      </span>
                    )}
                  </button>
                  {notificationsOpen && (
                    <div className='absolute right-0 mt-3 w-[min(90vw,380px)] overflow-hidden rounded-2xl border border-border bg-surface shadow-xl'>
                      <div className='flex items-center justify-between border-b border-border px-4 py-3'>
                        <p className='text-sm font-semibold text-foreground'>Notificacoes</p>
                        <span className='text-xs font-semibold text-muted'>{unreadNotifications} nao lida(s)</span>
                      </div>
                      <div className='max-h-[420px] overflow-y-auto'>
                        {notifications.length === 0 ? (
                          <p className='px-4 py-8 text-center text-sm text-muted'>Nenhuma notificacao.</p>
                        ) : (
                          notifications.map((notification) => {
                            const content = (
                              <>
                                <span className='block text-sm font-semibold text-foreground'>{notification.title}</span>
                                <span className='mt-1 block text-xs leading-5 text-muted'>{notification.message}</span>
                                <span className='mt-2 block text-[11px] font-semibold text-muted'>
                                  {new Date(notification.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              </>
                            )
                            const className = `block w-full border-b border-border px-4 py-3 text-left transition last:border-b-0 hover:bg-surface-secondary ${
                              notification.readAt ? 'bg-surface' : 'bg-primary/6'
                            }`

                            return notification.href ? (
                              <Link
                                key={notification.id}
                                href={notification.href}
                                onClick={() => void markNotificationRead(notification)}
                                className={className}
                              >
                                {content}
                              </Link>
                            ) : (
                              <button
                                key={notification.id}
                                type='button'
                                onClick={() => void markNotificationRead(notification)}
                                className={className}
                              >
                                {content}
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className='relative'>
                <button
                  type='button'
                  onClick={() => {
                    setUserMenuOpen((current) => !current)
                    setNotificationsOpen(false)
                  }}
                  className='flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2 text-left shadow-sm transition hover:bg-surface-secondary'
                  aria-expanded={userMenuOpen}
                >
                  <div className='flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white'>
                    {(currentUser?.name ?? currentUser?.email ?? 'LO').slice(0, 2).toUpperCase()}
                  </div>
                  <div className='hidden min-w-0 pr-1 sm:block'>
                    <p className='max-w-[180px] truncate text-sm font-semibold text-foreground'>{currentUser?.name || currentUser?.email || 'Usuario'}</p>
                    <p className='max-w-[180px] truncate text-xs text-muted'>{currentUser?.email ?? 'Sessao ativa'}</p>
                  </div>
                  <svg className={`h-4 w-4 text-muted transition ${userMenuOpen ? 'rotate-180' : ''}`} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M6 9l6 6 6-6' />
                  </svg>
                </button>
                {userMenuOpen && (
                  <div className='absolute right-0 mt-3 w-64 overflow-hidden rounded-2xl border border-border bg-surface shadow-xl'>
                    <div className='border-b border-border px-4 py-3'>
                      <p className='truncate text-sm font-semibold text-foreground'>{currentUser?.name || 'Usuario Lotiva'}</p>
                      <p className='mt-1 truncate text-xs text-muted'>{currentUser?.email ?? 'Sessao ativa'}</p>
                    </div>
                    <button
                      type='button'
                      onClick={() => signOut({ callbackUrl: '/signin' })}
                      className='flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'
                    >
                      Sair
                      <svg className='h-4 w-4 text-muted' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12' />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              </div>
            </div>
          </header>

          <main className='flex-1 px-4 py-6 sm:px-6 lg:px-8'>{children}</main>
        </div>
      </div>

      {sidebarOpen && (
        <button
          type='button'
          aria-label='Close sidebar overlay'
          className='fixed inset-0 z-30 bg-slate-950/40 lg:hidden'
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
