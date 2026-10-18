'use client'

import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

export default function SignInForm() {
  return <Suspense fallback={null}><SignInFormContent /></Suspense>
}

function SignInFormContent() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [loading, setLoading] = useState(false)
  const [magicLinkLoading, setMagicLinkLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const callbackUrl = searchParams.get('callbackUrl') ?? '/'
  const accessError = searchParams.get('error')
  const accessErrorMessage = accessError === 'AccessDenied'
    ? 'Este usuario nao possui uma funcao com acesso ao sistema.'
    : accessError === 'SessionRequired'
      ? 'Sua sessao expirou. Solicite um novo codigo de acesso.'
      : null

  async function requestCode() {
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/auth/code/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(data.error || 'Nao foi possivel enviar o codigo.')
        return
      }
      setStep('code')
      setNotice('Se o email estiver autorizado, o codigo chegara em instantes.')
    } catch {
      setError('Sem conexao. Verifique sua internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function verifyCode() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/code/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, callbackUrl }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(data.error || 'Codigo invalido ou expirado.')
        return
      }
      window.location.replace(data.url || '/')
    } catch {
      setError('Sem conexao. Verifique sua internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step === 'email') await requestCode()
    else await verifyCode()
  }

  async function requestMagicLink() {
    setMagicLinkLoading(true)
    setError(null)
    try {
      const result = await signIn('email', { email, callbackUrl, redirect: false })
      if (result?.error) {
        setError('Nao foi possivel enviar o link de acesso.')
        return
      }
      window.location.href = '/auth/verify-request'
    } catch {
      setError('Sem conexao. Verifique sua internet e tente novamente.')
    } finally {
      setMagicLinkLoading(false)
    }
  }

  return (
    <form className='mt-8 space-y-5' onSubmit={handleSubmit}>
      <div>
        <label htmlFor='email' className='mb-2 block text-sm font-semibold text-foreground'>Email</label>
        <input id='email' name='email' type='email' required autoComplete='email' disabled={step === 'code'} value={email} onChange={(event) => setEmail(event.target.value)} placeholder='voce@empresa.com' className='h-12 w-full rounded-lg border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:bg-surface-secondary' />
      </div>

      {step === 'code' && (
        <div>
          <div className='mb-2 flex items-center justify-between gap-3'>
            <label htmlFor='code' className='block text-sm font-semibold text-foreground'>Codigo de 6 digitos</label>
            <button type='button' onClick={() => { setStep('email'); setCode(''); setError(null); setNotice(null) }} className='text-xs font-semibold text-primary'>Alterar email</button>
          </div>
          <input id='code' name='code' type='text' required inputMode='numeric' autoComplete='one-time-code' maxLength={6} autoFocus value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder='000000' className='h-14 w-full rounded-lg border border-border bg-white px-4 text-center font-mono text-2xl font-bold tracking-[0.4em] text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10' />
        </div>
      )}

      {(error || accessErrorMessage) && <div className='rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm font-medium text-danger'>{error ?? accessErrorMessage}</div>}
      {notice && !error && <div className='rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-primary'>{notice}</div>}

      <button type='submit' disabled={loading || (step === 'code' && code.length !== 6)} className='flex h-12 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-70'>
        {loading ? 'Aguarde...' : step === 'email' ? 'Receber codigo' : 'Entrar no Lotiva'}
      </button>

      {step === 'code' && <button type='button' disabled={loading} onClick={() => void requestCode()} className='w-full text-sm font-semibold text-primary disabled:opacity-60'>Reenviar codigo</button>}

      <div className='border-t border-border pt-5 text-center'>
        <p className='text-xs text-muted'>Prefere entrar pelo link?</p>
        <button type='button' disabled={!email || magicLinkLoading} onClick={() => void requestMagicLink()} className='mt-2 text-sm font-semibold text-foreground disabled:opacity-50'>
          {magicLinkLoading ? 'Enviando link...' : 'Enviar link magico'}
        </button>
      </div>
    </form>
  )
}
