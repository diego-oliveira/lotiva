import { getCurrentSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import SignInForm from './SignInForm'

export default async function SignInPage() {
  const session = await getCurrentSession()

  if (session) {
    redirect('/')
  }

  return (
    <main className='flex min-h-screen items-center justify-center bg-background px-4 py-10'>
      <section className='grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-white shadow-sm lg:grid-cols-[0.95fr_1.05fr]'>
        <div className='bg-sidebar px-8 py-10 text-white sm:px-10'>
          <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-base font-bold shadow-lg shadow-primary/20'>
            L
          </div>
          <div className='mt-16'>
            <p className='text-xs font-semibold uppercase tracking-[0.24em] text-slate-400'>Lotiva</p>
            <h1 className='mt-3 text-3xl font-bold tracking-tight'>Acesse o Lotiva</h1>
            <p className='mt-4 max-w-sm text-sm leading-6 text-slate-300'>
              Receba um codigo seguro por email e continue no mesmo navegador do seu celular.
            </p>
          </div>
        </div>

        <div className='px-8 py-10 sm:px-12'>
          <p className='text-sm font-medium text-muted'>Acesso seguro</p>
          <h2 className='mt-2 text-2xl font-bold text-foreground'>Entre com seu email</h2>
          <p className='mt-3 text-sm leading-6 text-muted'>
            Enviaremos um codigo de 6 digitos. Voce nao precisa abrir o link no navegador interno do aplicativo de email.
          </p>
          <SignInForm />
        </div>
      </section>
    </main>
  )
}
