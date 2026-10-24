type Development = { id: string; name: string; settings: { paymentMethods: string | null; maxInstallments: number; minDownPaymentPercentage: unknown } | null }
type ScopedRecord = { developmentId: string | null }
type Alert = { developmentId: string; developmentName: string; kind: string; title: string; description: string; href: string; tone: 'amber' | 'red' }

export function dashboardAlerts({ developments, lots, receivables, reservations, today }: {
  developments: Development[]
  lots: (ScopedRecord & { status: string })[]
  receivables: (ScopedRecord & { status: string; dueDate: Date; balance: number })[]
  reservations: ScopedRecord[]
  today: Date
}): Alert[] {
  return developments.flatMap((development) => {
    const alerts: Alert[] = []
    const add = (alert: Omit<Alert, 'developmentId' | 'developmentName'>) => alerts.push({ ...alert, developmentId: development.id, developmentName: development.name })
    const id = encodeURIComponent(development.id)
    const setupHref = `/developments?developmentId=${id}#development-${id}`
    const settings = development.settings
    if (!settings || !settings.paymentMethods || settings.maxInstallments <= 0 || Number(settings.minDownPaymentPercentage) < 0) {
      add({ kind: 'settings', title: 'Revise as configurações comerciais', description: 'Defina formas de pagamento, entrada mínima, juros e prazo máximo antes de escalar vendas.', href: setupHref, tone: 'amber' })
    }
    const stock = lots.filter((item) => item.developmentId === development.id)
    if (!stock.length) {
      add({ kind: 'stock', title: 'Cadastre quadras e lotes', description: 'O empreendimento ainda não tem estoque para o time comercial consultar.', href: setupHref, tone: 'amber' })
    } else if (!stock.some((item) => item.status === 'available')) {
      add({ kind: 'availability', title: 'Sem lotes disponíveis', description: 'Libere ou cadastre novos lotes para manter o funil de venda ativo.', href: `/lots?developmentId=${id}`, tone: 'red' })
    }
    const overdue = receivables.filter((item) => item.developmentId === development.id && item.status !== 'paid' && item.dueDate < today)
    if (overdue.length) {
      const amount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(overdue.reduce((sum, item) => sum + item.balance, 0))
      add({ kind: 'overdue', title: `${overdue.length} parcela(s) vencida(s)`, description: `${amount} em aberto exige acompanhamento financeiro.`, href: `/finance?developmentId=${id}&view=list&status=overdue`, tone: 'red' })
    }
    const expiring = reservations.filter((item) => item.developmentId === development.id)
    if (expiring.length) {
      add({ kind: 'reservations', title: `${expiring.length} reserva(s) vencem em até 3 dias`, description: 'Priorize contato com os clientes antes de liberar os lotes.', href: `/lots?developmentId=${id}&status=reserved`, tone: 'amber' })
    }
    return alerts
  })
}
