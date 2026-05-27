import Link from 'next/link'

const statCards = [
  {
    label: 'Companies',
    value: '12',
    change: '+4.2%',
  },
  {
    label: 'Developments',
    value: '28',
    change: '+8.1%',
  },
  {
    label: 'Open Sales',
    value: '43',
    change: '+2.6%',
  },
  {
    label: 'Lots Inventory',
    value: '318',
    change: '+12.0%',
  },
]

const shortcuts = [
  {
    href: '/companies',
    title: 'Gerenciar empresas',
    description: 'Cadastre grupos e construtoras proprietarias dos empreendimentos.',
  },
  {
    href: '/developments',
    title: 'Gerenciar empreendimentos',
    description: 'Controle loteamentos, condominios e projetos ligados a cada empresa.',
  },
  {
    href: '/sales',
    title: 'Acompanhar vendas',
    description: 'Consulte contratos, vendas em aberto e a operacao comercial.',
  },
]

export default function Home() {
  return (
    <div className='space-y-6'>
      <section className='grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]'>
        <div className='panel overflow-hidden'>
          <div className='border-b border-border px-6 py-5'>
            <div className='flex flex-wrap items-center justify-between gap-4'>
              <div>
                <p className='text-sm font-medium text-muted'>Operational Dashboard</p>
                <h1 className='mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-[30px]'>
                  Real estate command center
                </h1>
              </div>
              <span className='pill pill-primary'>Live workspace</span>
            </div>
          </div>

          <div className='grid gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:px-8'>
            <div>
              <h2 className='max-w-3xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl'>
                Centralize empresas, empreendimentos, lotes e vendas in one operational dashboard.
              </h2>
              <p className='mt-4 max-w-2xl text-base leading-7 text-muted'>
                The structure is now aligned to your business model: company at the top, developments beneath it,
                then blocks, lots, users, and sales.
              </p>
              <div className='mt-6 flex flex-wrap gap-3'>
                <Link href='/companies' className='rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-strong'>
                  Abrir empresas
                </Link>
                <Link href='/developments' className='rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'>
                  Abrir empreendimentos
                </Link>
              </div>
            </div>

            <div className='rounded-2xl border border-border bg-surface-secondary p-5'>
              <p className='text-sm font-semibold text-foreground'>Workspace Notes</p>
              <div className='mt-4 space-y-4'>
                {[
                  'Companies own developments.',
                  'Developments own blocks.',
                  'Blocks own lots and sales operate on those lots.',
                ].map((item, index) => (
                  <div key={item} className='flex items-start gap-3'>
                    <div className='mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-white'>
                      {index + 1}
                    </div>
                    <p className='text-sm leading-6 text-muted'>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-1'>
          {statCards.map((card) => (
            <div key={card.label} className='metric-card px-5 py-5'>
              <div className='flex items-center justify-between'>
                <p className='metric-label'>{card.label}</p>
                <span className='rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600'>
                  {card.change}
                </span>
              </div>
              <p className='metric-value mt-3'>{card.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]'>
        <div className='panel overflow-hidden'>
          <div className='panel-header flex items-center justify-between px-6 py-5'>
            <div>
              <h2 className='text-lg font-semibold text-foreground'>Quick Access</h2>
              <p className='mt-1 text-sm text-muted'>Core management areas already refit into the new layout.</p>
            </div>
            <Link href='/sales' className='text-sm font-semibold text-primary'>
              See all
            </Link>
          </div>
          <div className='overflow-x-auto'>
            <table className='min-w-full'>
              <thead className='bg-surface-secondary'>
                <tr>
                  <th className='table-head px-6 py-4 text-left'>Area</th>
                  <th className='table-head px-6 py-4 text-left'>Description</th>
                  <th className='table-head px-6 py-4 text-left'>Status</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border bg-surface'>
                {shortcuts.map((shortcut, index) => (
                  <tr key={shortcut.href} className='hover:bg-surface-secondary/70 transition'>
                    <td className='px-6 py-5'>
                      <Link href={shortcut.href} className='font-semibold text-foreground hover:text-primary'>
                        {shortcut.title}
                      </Link>
                    </td>
                    <td className='px-6 py-5 text-sm text-muted'>{shortcut.description}</td>
                    <td className='px-6 py-5'>
                      <span className={`pill ${index === 2 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {index === 2 ? 'In Progress' : 'Ready'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className='panel'>
          <div className='panel-header px-6 py-5'>
            <h2 className='text-lg font-semibold text-foreground'>Next Refactors</h2>
            <p className='mt-1 text-sm text-muted'>Recommended sequence to keep the model coherent.</p>
          </div>
          <div className='space-y-4 px-6 py-6'>
            {[
              'Attach blocks to a development during create and edit flows.',
              'Rename clients pages and routes to users for domain consistency.',
              'Apply the same admin shell styling to lots and sales tables.',
            ].map((item, index) => (
              <div key={item} className='flex gap-4 rounded-2xl border border-border bg-surface-secondary px-4 py-4'>
                <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white'>
                  {index + 1}
                </div>
                <p className='text-sm leading-6 text-muted'>{item}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  )
}
