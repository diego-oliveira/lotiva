export default function OfflinePage() {
  return (
    <main className='flex min-h-[100dvh] items-center justify-center bg-background px-6 text-center'>
      <section className='max-w-sm'>
        <div className='mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-white'>L</div>
        <h1 className='mt-6 text-2xl font-bold text-foreground'>Sem conexao</h1>
        <p className='mt-3 text-sm leading-6 text-muted'>Conecte-se a internet para atualizar os lotes e continuar usando o Lotiva.</p>
        <a href='/' className='mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white'>Tentar novamente</a>
      </section>
    </main>
  )
}
