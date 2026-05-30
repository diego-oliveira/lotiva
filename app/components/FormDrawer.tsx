'use client'

interface FormDrawerProps {
  isOpen: boolean
  title: string
  description: string
  onClose: () => void
  children: React.ReactNode
}

export default function FormDrawer({
  isOpen,
  title,
  description,
  onClose,
  children,
}: FormDrawerProps) {
  if (!isOpen) return null

  return (
    <>
      <button
        type='button'
        aria-label='Close form drawer overlay'
        className='fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px] lg:left-[290px]'
        onClick={onClose}
      />
      <aside className='fixed inset-y-0 right-0 z-50 w-full max-w-2xl border-l border-border bg-surface shadow-2xl'>
        <div className='flex h-full flex-col'>
          <div className='border-b border-border px-6 py-5'>
            <div className='flex items-start justify-between gap-4'>
              <div>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-muted'>Entry editor</p>
                <h2 className='mt-2 text-2xl font-bold text-foreground'>{title}</h2>
                <p className='mt-2 text-sm leading-6 text-muted'>{description}</p>
              </div>
              <button
                type='button'
                onClick={onClose}
                className='rounded-xl border border-border bg-surface-secondary p-2 text-muted transition hover:bg-background hover:text-foreground'
              >
                <svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M6 18L18 6M6 6l12 12' />
                </svg>
              </button>
            </div>
          </div>
          <div className='flex-1 overflow-y-auto px-6 py-6'>{children}</div>
        </div>
      </aside>
    </>
  )
}
