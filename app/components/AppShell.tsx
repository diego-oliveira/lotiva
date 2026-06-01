'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type NavItem = {
  href: string
  label: string
  description: string
  icon: 'dashboard' | 'setup' | 'company' | 'development' | 'user' | 'lot' | 'sale' | 'finance'
  permission?: 'admin' | 'manageSettings' | 'manageUsers' | 'sales' | 'finance'
}

type PermissionMap = {
  admin: boolean
  manageSettings: boolean
  manageUsers: boolean
  sales: boolean
  finance: boolean
}

const navItems: NavItem[] = [
  {
    href: '/',
    label: 'Dashboard',
    description: 'Overview',
    icon: 'dashboard',
  },
  {
    href: '/onboarding',
    label: 'Onboarding',
    description: 'Client setup',
    icon: 'setup',
    permission: 'manageSettings',
  },
  {
    href: '/companies',
    label: 'Empresas',
    description: 'Holding companies',
    icon: 'company',
    permission: 'manageSettings',
  },
  {
    href: '/developments',
    label: 'Empreendimentos',
    description: 'Projects and subdivisions',
    icon: 'development',
    permission: 'manageSettings',
  },
  {
    href: '/clients',
    label: 'Usuarios',
    description: 'People and records',
    icon: 'user',
    permission: 'manageUsers',
  },
  {
    href: '/lots',
    label: 'Lotes',
    description: 'Inventory',
    icon: 'lot',
    permission: 'sales',
  },
  {
    href: '/sales',
    label: 'Vendas',
    description: 'Transactions',
    icon: 'sale',
    permission: 'sales',
  },
  {
    href: '/finance',
    label: 'Financeiro',
    description: 'Receivables',
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
  const [permissions, setPermissions] = useState<PermissionMap | null>(null)
  const isAuthPage = pathname.startsWith('/signin') || pathname.startsWith('/auth')

  useEffect(() => {
    if (isAuthPage) return
    fetch('/api/me/permissions', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setPermissions(payload?.permissions ?? null))
      .catch(() => setPermissions(null))
  }, [isAuthPage])

  const visibleNavItems = useMemo(() => {
    if (!permissions) return navItems
    return navItems.filter((item) => !item.permission || permissions[item.permission])
  }, [permissions])

  const currentItem = useMemo(
    () => visibleNavItems.find((item) => (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href))),
    [pathname, visibleNavItems],
  )

  if (isAuthPage) {
    return <>{children}</>
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
                <h1 className='mt-1 text-[19px] font-semibold text-white'>Management</h1>
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
            <div className='mb-7 rounded-2xl border border-white/8 bg-white/5 px-4 py-4'>
              <p className='text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400'>Current area</p>
              <p className='mt-2 text-lg font-semibold text-white'>{currentItem?.label ?? 'Workspace'}</p>
              <p className='mt-1 text-sm text-slate-400'>{currentItem?.description ?? 'Navigate the platform'}</p>
            </div>

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
              Sign out
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
                  <p className='text-xs font-semibold uppercase tracking-[0.2em] text-muted'>TailAdmin-style workspace</p>
                  <p className='mt-1 text-lg font-semibold text-foreground'>{currentItem?.label ?? 'Dashboard'}</p>
                </div>
              </div>

              <div className='hidden items-center gap-4 md:flex'>
                <div className='flex min-w-[320px] items-center gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm text-muted'>
                  <svg className='h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z' />
                  </svg>
                  <span>Search or type command...</span>
                </div>
                <button type='button' className='rounded-xl border border-border bg-surface p-3 text-muted transition hover:bg-surface-secondary'>
                  <svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9' />
                  </svg>
                </button>
                <button
                  type='button'
                  onClick={() => signOut({ callbackUrl: '/signin' })}
                  className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-muted transition hover:bg-surface-secondary hover:text-foreground'
                >
                  Sign out
                </button>
                <div className='flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2 shadow-sm'>
                  <div className='flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white'>
                    LO
                  </div>
                  <div className='pr-1'>
                    <p className='text-sm font-semibold text-foreground'>Lotiva Admin</p>
                    <p className='text-xs text-muted'>Operations</p>
                  </div>
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
