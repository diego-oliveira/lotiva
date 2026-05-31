'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type ChecklistStatus = 'complete' | 'action' | 'pending'

type ChecklistItem = {
  id: string
  title: string
  description: string
  href: string
  status: ChecklistStatus
  metric: string
}

type OnboardingStatus = {
  progress: number
  readyForSales: boolean
  completedCount: number
  totalCount: number
  counts: {
    companies: number
    developments: number
    users: number
    blocks: number
    lots: number
    sales: number
    contracts: number
    emailedContracts: number
  }
  checklist: ChecklistItem[]
}

const statusLabel: Record<ChecklistStatus, string> = {
  complete: 'Complete',
  action: 'Needs action',
  pending: 'Waiting',
}

const statusClass: Record<ChecklistStatus, string> = {
  complete: 'bg-emerald-50 text-emerald-700',
  action: 'bg-amber-50 text-amber-700',
  pending: 'bg-slate-100 text-slate-600',
}

const setupNotes = [
  'Company and development structure should be in place before users are invited.',
  'Lots need complete pricing and dimensions before sales can be tested.',
  'A generated and emailed contract is the final operational smoke test.',
]

export default function OnboardingPage() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStatus() {
      try {
        setLoading(true)
        const response = await fetch('/api/onboarding/status')
        if (!response.ok) throw new Error('Failed to load onboarding status')
        setStatus(await response.json())
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
  }, [])

  const nextStep = useMemo(
    () => status?.checklist.find((item) => item.status === 'action') ?? status?.checklist.find((item) => item.status === 'pending'),
    [status],
  )

  if (loading) {
    return (
      <div className='space-y-6'>
        <div className='h-24 animate-pulse rounded-2xl bg-surface-secondary' />
        <div className='grid gap-4 md:grid-cols-3'>
          {[1, 2, 3].map((item) => (
            <div key={item} className='h-32 animate-pulse rounded-2xl bg-surface-secondary' />
          ))}
        </div>
      </div>
    )
  }

  if (error || !status) {
    return <div className='rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700'>{error ?? 'Unable to load onboarding status'}</div>
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='page-title'>Client Onboarding</h1>
          <p className='page-subtitle'>Track the setup work needed before a signed client can operate in Lotiva.</p>
        </div>
        {nextStep && (
          <Link href={nextStep.href} className='inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-strong'>
            Continue setup
          </Link>
        )}
      </div>

      <section className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]'>
        <div className='panel overflow-hidden'>
          <div className='panel-header px-6 py-5'>
            <div className='flex flex-col gap-5 md:flex-row md:items-center md:justify-between'>
              <div>
                <p className='text-sm font-medium text-muted'>Setup progress</p>
                <h2 className='mt-2 text-2xl font-bold text-foreground'>
                  {status.readyForSales ? 'Ready for sales operations' : `${status.completedCount} of ${status.totalCount} steps complete`}
                </h2>
              </div>
              <span className={`pill ${status.readyForSales ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {status.readyForSales ? 'Go live ready' : 'Configuration needed'}
              </span>
            </div>
            <div className='mt-6 h-3 overflow-hidden rounded-full bg-surface-secondary'>
              <div className='h-full rounded-full bg-primary transition-all' style={{ width: `${status.progress}%` }} />
            </div>
          </div>

          <div className='divide-y divide-border'>
            {status.checklist.map((item, index) => (
              <div key={item.id} className='grid gap-4 px-6 py-5 md:grid-cols-[44px_minmax(0,1fr)_auto] md:items-center'>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-semibold ${item.status === 'complete' ? 'bg-emerald-600 text-white' : item.status === 'action' ? 'bg-primary text-white' : 'bg-surface-secondary text-muted'}`}>
                  {item.status === 'complete' ? 'OK' : index + 1}
                </div>
                <div>
                  <div className='flex flex-wrap items-center gap-2'>
                    <h3 className='text-base font-semibold text-foreground'>{item.title}</h3>
                    <span className={`pill ${statusClass[item.status]}`}>{statusLabel[item.status]}</span>
                  </div>
                  <p className='mt-1 text-sm leading-6 text-muted'>{item.description}</p>
                </div>
                <div className='flex items-center gap-3 md:justify-end'>
                  <span className='text-sm font-semibold text-muted'>{item.metric}</span>
                  <Link href={item.href} className='rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'>
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className='space-y-6'>
          <div className='panel'>
            <div className='panel-header px-6 py-5'>
              <h2 className='text-lg font-semibold text-foreground'>Current Workspace</h2>
              <p className='mt-1 text-sm text-muted'>Counts reflect records you can access.</p>
            </div>
            <div className='grid grid-cols-2 gap-4 px-6 py-6'>
              {[
                ['Companies', status.counts.companies],
                ['Developments', status.counts.developments],
                ['Users', status.counts.users],
                ['Lots', status.counts.lots],
                ['Sales', status.counts.sales],
                ['Contracts', status.counts.contracts],
              ].map(([label, value]) => (
                <div key={label} className='rounded-2xl border border-border bg-surface-secondary px-4 py-4'>
                  <p className='text-xs font-semibold uppercase text-muted'>{label}</p>
                  <p className='mt-2 text-2xl font-bold text-foreground'>{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className='panel'>
            <div className='panel-header px-6 py-5'>
              <h2 className='text-lg font-semibold text-foreground'>Operational Notes</h2>
            </div>
            <div className='space-y-4 px-6 py-6'>
              {setupNotes.map((note, index) => (
                <div key={note} className='flex gap-3'>
                  <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-white'>
                    {index + 1}
                  </div>
                  <p className='text-sm leading-6 text-muted'>{note}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  )
}
