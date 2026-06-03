'use client'

import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

export default function SignInForm() {
  return (
    <Suspense fallback={null}>
      <SignInFormContent />
    </Suspense>
  )
}

function SignInFormContent() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const callbackUrl = searchParams.get('callbackUrl') ?? '/'

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const result = await signIn('email', {
      email,
      callbackUrl,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('Nao foi possivel enviar o link de acesso. Verifique a configuracao de email.')
      return
    }

    window.location.href = '/auth/verify-request'
  }

  return (
    <form className='mt-8 space-y-5' onSubmit={handleSubmit}>
      <div>
        <label htmlFor='email' className='mb-2 block text-sm font-semibold text-foreground'>
          Email
        </label>
        <input
          id='email'
          name='email'
          type='email'
          required
          autoComplete='email'
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder='voce@empresa.com'
          className='h-12 w-full rounded-lg border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10'
        />
      </div>

      {error && (
        <div className='rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm font-medium text-danger'>
          {error}
        </div>
      )}

      <button
        type='submit'
        disabled={loading}
        className='flex h-12 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-70'
      >
        {loading ? 'Enviando...' : 'Enviar link de acesso'}
      </button>
    </form>
  )
}
