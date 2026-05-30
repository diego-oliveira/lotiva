'use client'

interface InlineAlertProps {
  variant: 'success' | 'error' | 'info'
  title: string
  message: string
  onClose?: () => void
}

const styles = {
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icon: 'bg-emerald-100 text-emerald-600',
  },
  error: {
    wrapper: 'border-red-200 bg-red-50 text-red-800',
    icon: 'bg-red-100 text-red-600',
  },
  info: {
    wrapper: 'border-sky-200 bg-sky-50 text-sky-800',
    icon: 'bg-sky-100 text-sky-600',
  },
} as const

export default function InlineAlert({
  variant,
  title,
  message,
  onClose,
}: InlineAlertProps) {
  const tone = styles[variant]

  return (
    <div className={`flex items-start gap-4 rounded-2xl border px-5 py-4 ${tone.wrapper}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}>
        <svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth='1.8'
            d={variant === 'success'
              ? 'M9 12.75l2.25 2.25L15 9.75m6 2.25a9 9 0 11-18 0 9 9 0 0118 0z'
              : 'M12 9v3.75m0 3.75h.008v.008H12v-.008zm9-3.758a9 9 0 11-18 0 9 9 0 0118 0z'}
          />
        </svg>
      </div>

      <div className='min-w-0 flex-1'>
        <p className='text-sm font-semibold'>{title}</p>
        <p className='mt-1 text-sm leading-6 opacity-90'>{message}</p>
      </div>

      {onClose && (
        <button
          type='button'
          onClick={onClose}
          className='rounded-lg p-1 opacity-70 transition hover:bg-white/40 hover:opacity-100'
        >
          <svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M6 18L18 6M6 6l12 12' />
          </svg>
        </button>
      )}
    </div>
  )
}
