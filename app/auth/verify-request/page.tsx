import Link from 'next/link'

export default function VerifyRequestPage() {
  return (
    <main className='flex min-h-screen items-center justify-center bg-background px-4 py-10'>
      <section className='w-full max-w-md rounded-2xl border border-border bg-white px-8 py-10 text-center shadow-sm'>
        <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-base font-bold text-white'>
          L
        </div>
        <h1 className='mt-6 text-2xl font-bold text-foreground'>Verifique seu email</h1>
        <p className='mt-3 text-sm leading-6 text-muted'>
          Se este email tiver acesso ao Lotiva, enviaremos um link de entrada em alguns instantes.
        </p>
        <Link
          href='/signin'
          className='mt-8 inline-flex h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'
        >
          Voltar ao signin
        </Link>
      </section>
    </main>
  )
}
