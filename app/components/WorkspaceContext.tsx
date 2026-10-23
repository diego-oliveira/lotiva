'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState, useId } from 'react'
import { ALL_DEVELOPMENTS, workspaceMode, workspaceOptions, workspaceHref, resolveWorkspaceScope, type WorkspaceOption } from '@/lib/workspace'

function ContextLink({ href, ...props }: React.ComponentProps<typeof Link>) {
  const params = useSearchParams()
  return <Link {...props} href={typeof href === 'string' ? workspaceHref(href, params.get('developmentId')) : href} />
}
export function WorkspaceLink(props: React.ComponentProps<typeof Link>) {
  return <Suspense fallback={<Link {...props} />}><ContextLink {...props} /></Suspense>
}

function DevelopmentPicker({ options, scope, label, canConsolidate, onChange }: { options: WorkspaceOption[]; scope: string; label: string; canConsolidate: boolean; onChange: (id: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const popupId = useId()
  const close = () => { setOpen(false); trigger.current?.focus() }
  useEffect(() => {
    if (!open) return
    input.current?.focus()
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])
  const choose = async (id: string) => {
    if (id === scope) { close(); return }
    setPending(true); setError('')
    try { await onChange(id); close() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível trocar o loteamento.') }
    finally { setPending(false) }
  }
  if (options.length === 1) return <span className='inline-block max-w-full break-words rounded-lg bg-primary/10 px-3 py-2 font-semibold text-foreground'>{label}</span>
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const filtered = options.filter((item) => normalize(`${item.name} ${item.company?.name ?? ''}`).includes(normalize(search.trim())))
  return <div ref={root} className='relative min-w-0' onKeyDown={(event) => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close() }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const items = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[data-development-option]:not(:disabled)') ?? [])
      if (!open || !items.length) return
      event.preventDefault()
      const index = items.indexOf(document.activeElement as HTMLButtonElement)
      items[index < 0 ? (event.key === 'ArrowDown' ? 0 : items.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
    }
  }} onBlur={(event) => { if (!pending && !event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <button ref={trigger} type='button' aria-expanded={open} aria-controls={popupId} aria-haspopup='dialog' aria-label={`Trocar loteamento: ${label}`} onClick={() => { setOpen(!open); setSearch(''); setError('') }} className='inline-flex max-w-full items-center gap-2 rounded-lg border border-primary/15 bg-primary/10 px-3 py-2 text-left font-semibold text-foreground transition hover:border-primary/30 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'>
      <span className='min-w-0 whitespace-normal break-words'>{label}</span>
      <svg aria-hidden='true' className='h-3.5 w-3.5 shrink-0' viewBox='0 0 20 20' fill='none' stroke='currentColor'><path d='m5 7.5 5 5 5-5' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' /></svg>
    </button>
    {open && <div id={popupId} role='dialog' aria-label='Selecionar loteamento' aria-busy={pending} className='absolute left-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border border-border bg-surface shadow-lg'>
      <div className='border-b border-border p-2'><input ref={input} aria-label='Buscar loteamento' placeholder='Buscar loteamento…' value={search} onChange={(event) => setSearch(event.target.value)} className='w-full rounded-lg bg-surface-secondary px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary' /></div>
      <div className='max-h-72 overflow-y-auto p-1.5'>
        {canConsolidate && <div className='mb-1 border-b border-border pb-1'><button type='button' data-development-option disabled={pending} onClick={() => void choose(ALL_DEVELOPMENTS)} className='flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-foreground hover:bg-surface-secondary focus:bg-surface-secondary focus:outline-none disabled:opacity-50'>Todos os loteamentos<span aria-label={scope === ALL_DEVELOPMENTS ? 'Selecionado' : undefined}>{scope === ALL_DEVELOPMENTS ? '✓' : ''}</span></button></div>}
        {filtered.map((item) => <button key={item.id} type='button' data-development-option disabled={pending} onClick={() => void choose(item.id)} className='flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-foreground hover:bg-surface-secondary focus:bg-surface-secondary focus:outline-none disabled:opacity-50'><span className='min-w-0'><span className='block whitespace-normal break-words'>{item.name}</span>{item.company?.name && <span className='mt-0.5 block whitespace-normal break-words text-xs text-muted'>{item.company.name}</span>}</span><span aria-label={scope === item.id ? 'Selecionado' : undefined}>{scope === item.id ? '✓' : ''}</span></button>)}
        {!filtered.length && <p className='px-3 py-4 text-sm text-muted'>Nenhum loteamento encontrado.</p>}
      </div>
      {pending && <p role='status' className='px-4 pb-3 text-xs text-muted'>Alterando loteamento…</p>}
      {error && <p role='alert' className='px-4 pb-3 text-xs text-red-700'>{error}</p>}
    </div>}
  </div>
}

type ContextProps = { developments: WorkspaceOption[] | null; preference: string | null; children: React.ReactNode }

function Content({ developments, preference, children }: ContextProps) {
  const pathname = usePathname()
  const params = useSearchParams()
  const router = useRouter()
  const mode = workspaceMode(pathname)
  const options = workspaceOptions(pathname, developments ?? [])
  const scope = params.get('developmentId') || ''
  const enabled = !!mode && !(pathname === '/' && params.get('chooseDevelopment') === '1')
  useEffect(() => {
    if (!enabled || !developments || !options.length || (scope && !(scope === ALL_DEVELOPMENTS && options.length === 1))) return
    const next = new URLSearchParams(params.toString())
    next.set('developmentId', resolveWorkspaceScope(null, options.map((item) => item.id), preference))
    router.replace(`${pathname}?${next}`)
  }, [enabled, developments, preference, pathname, scope, params, router]) // eslint-disable-line react-hooks/exhaustive-deps
  const change = async (id: string) => {
    const response = await fetch('/api/me/workspace', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ developmentId: id }) })
    if (!response.ok) throw new Error('Não foi possível salvar a seleção. Tente novamente.')
    const next = new URLSearchParams()
    ;['view', 'month', 'calendarBy', 'tab', 'status', 'search', 'dueFrom', 'dueTo'].forEach((key) => { const value = params.get(key); if (value !== null) next.set(key, value) })
    next.set('developmentId', id)
    router.push(`${pathname}?${next}`)
  }
  if (!mode || (pathname === '/' && params.get('chooseDevelopment') === '1')) return <>{children}</>
  if (!developments) return <div className='h-40 animate-pulse rounded-2xl bg-surface-secondary' aria-label='Carregando contexto de trabalho' />
  if (!options.length) return <>{children}</>
  if (!scope) return <div className='h-40 animate-pulse rounded-2xl bg-surface-secondary' aria-label='Restaurando seleção de loteamento' />
  const selected = options.find((item) => item.id === scope)
  const consolidated = mode === 'consolidated' && scope === ALL_DEVELOPMENTS
  if (!selected && !consolidated) return <section className='panel p-6'>
    <h1 className='page-title'>Selecione um loteamento</h1>
    <p className='page-subtitle'>{scope === ALL_DEVELOPMENTS ? 'Esta tela trabalha com um loteamento por vez. Escolha onde deseja continuar.' : 'O loteamento informado não está disponível nesta área. Escolha um dos seus loteamentos.'}</p>
    <div className='mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>{options.map((item) => {
      const next = new URLSearchParams(params.toString()); next.set('developmentId', item.id)
      ;['lotId', 'userId', 'proposalId', 'reservationId'].forEach((key) => next.delete(key))
      return <Link key={item.id} href={`${pathname}?${next}`} className='rounded-xl border border-border bg-surface p-4 transition hover:border-primary'><p className='font-semibold text-foreground'>{item.name}</p><p className='mt-1 text-xs text-muted'>{item.company?.name}</p></Link>
    })}</div>
  </section>
  return <div key={scope} className='space-y-5'>
    <nav aria-label='Localização' className='text-sm'>
      <ol className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
        <li className='min-w-0 max-w-full text-muted'>
          <DevelopmentPicker options={options} scope={scope} label={consolidated ? 'Todos os loteamentos' : selected!.name} canConsolidate={mode === 'consolidated'} onChange={change} />
        </li>
        <li aria-hidden='true' className='text-muted/60'>
          <svg className='h-3.5 w-3.5' viewBox='0 0 20 20' fill='none' stroke='currentColor'><path d='m7.5 5 5 5-5 5' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' /></svg>
        </li>
        <li aria-current='page' className='font-medium text-foreground'>
          {pathname === '/' ? 'Painel' : pathname.startsWith('/sales') ? 'Vendas' : pathname.startsWith('/proposals') ? 'Propostas' : pathname.startsWith('/finance') ? 'Recebimentos' : pathname.startsWith('/lots') ? 'Lotes' : pathname.startsWith('/distributions') || pathname.startsWith('/partner-settlements') ? 'Distribuição de resultados' : 'Comissões'}
        </li>
      </ol>
    </nav>
    {children}
  </div>
}
export default function WorkspaceContext(props: ContextProps) {
  return <Suspense fallback={<div className='h-40 animate-pulse rounded-2xl bg-surface-secondary' />}><Content {...props} /></Suspense>
}
