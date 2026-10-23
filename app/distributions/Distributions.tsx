'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { RecurringCost, SettlementExpense, SettlementAdjustment, SettlementSnapshot, SettlementReceipt, DistributionParticipant, AllocatedParticipant } from '@/lib/partner-settlements'

type Payment = { id: string; participantId: string; participantName: string; amount: number; paidAt: string; proofUrl: string | null; notes: string | null }
type Summary = { paid: number; remaining: number; status: string }
type Payload = {
  development: { id: string; name: string } | null
  developments: { id: string; name: string }[]
  canEdit: boolean
  agreement: { participants: DistributionParticipant[]; defaultCosts: RecurringCost[]; version: number } | null
  settlement: { id: string; month: string; status: string; version: number; closedAt: string | null; expenses: SettlementExpense[]; adjustments: SettlementAdjustment[]; payments: Payment[]; revisions: { id: string; number: number; reason: string; closedAt: string; createdAt: string }[] } | null
  allocations: (AllocatedParticipant & Summary)[]
  snapshot: SettlementSnapshot | null
  previewToken: string | null
  sourceChanged: boolean
  payment: Summary | null
  history: { id: string; month: string; status: string; participantCount: number; partnerAmount: number; payment: Summary | null }[]
}

type ParticipantForm = Omit<DistributionParticipant, 'percentage'> & { percentage: number | string }
type CostForm = { description: string; amount: number | string; category?: string }
type ExpenseForm = CostForm & { paidAt: string; proofUrl: string }
type AdjustmentForm = { description: string; amount: number | string; referenceMonth: string }
const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const date = (value: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia' }).format(new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value))
const monthName = (month: string) => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Bahia' }).format(new Date(`${month}-15T12:00:00-03:00`))
const previousMonth = () => { const [year, month] = today().split('-').map(Number); return new Date(Date.UTC(year, month - 2, 15)).toISOString().slice(0, 7) }
const field = 'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary disabled:opacity-60'
const secondary = 'rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-surface-secondary disabled:opacity-50'
const primary = 'rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-strong disabled:opacity-50'
const paymentLabel: Record<string, string> = { paid: 'Pago', partial: 'Pago parcialmente', pending: 'Pendente' }

function ProofLink({ url }: { url?: string | null }) {
  return url ? <a href={url} target='_blank' rel='noreferrer' className='text-xs font-semibold text-primary underline'>Ver comprovante</a> : null
}

function SourceTable({ items }: { items: SettlementReceipt[] }) {
  return items.length ? <div className='overflow-x-auto'><table className='w-full text-sm'><thead><tr className='border-b border-border text-left text-xs text-muted'><th className='py-2 pr-4'>Descrição</th><th className='py-2 pr-4'>Pagamento</th><th className='py-2 text-right'>Valor</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className='border-b border-border last:border-0'><td className='py-3 pr-4'>{item.description}</td><td className='whitespace-nowrap py-3 pr-4 text-muted'>{date(item.paidAt)}</td><td className='whitespace-nowrap py-3 text-right font-medium'>{money(item.amount)}</td></tr>)}</tbody></table></div> : <p className='py-3 text-sm text-muted'>Nenhum lançamento no período.</p>
}

function Content() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const developmentId = searchParams.get('developmentId') ?? ''
  const requestedMonth = searchParams.get('month') || previousMonth()
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : previousMonth()
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [agreementOpen, setAgreementOpen] = useState(false)
  const [agreement, setAgreement] = useState<{ participants: ParticipantForm[]; defaultCosts: CostForm[] }>({ participants: [], defaultCosts: [] })
  const [expenses, setExpenses] = useState<ExpenseForm[]>([])
  const [adjustments, setAdjustments] = useState<AdjustmentForm[]>([])
  const [dirty, setDirty] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [reopenReason, setReopenReason] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [payment, setPayment] = useState<{ paymentId: string; participantId: string; amount: string; paidAt: string; proofUrl: string; notes: string } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setData(null); setError(''); setPayment(null); setConfirmClose(false); setReopenReason(null); setDirty(false)
    void (async () => {
      try {
        const params = new URLSearchParams({ month })
        if (developmentId) params.set('developmentId', developmentId)
        const response = await fetch(`/api/partner-settlements?${params}`, { cache: 'no-store', signal: controller.signal })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar as distribuições.')
        if (controller.signal.aborted) return
        setData(payload)
        setAgreement(payload.agreement ? { participants: payload.agreement.participants, defaultCosts: payload.agreement.defaultCosts } : { participants: [], defaultCosts: [] })
        setAgreementOpen(!payload.agreement)
        setExpenses(payload.settlement?.expenses ?? [])
        setAdjustments(payload.settlement?.adjustments ?? [])
      } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Erro ao carregar.') }
      finally { if (!controller.signal.aborted) setLoading(false) }
    })()
    return () => controller.abort()
  }, [developmentId, month, reload])

  const mutate = async (body: Record<string, unknown>, message: string) => {
    if (!data?.development) return
    setBusy(true); setError(''); setSuccess('')
    try {
      const response = await fetch('/api/partner-settlements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, developmentId: data.development.id, month }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Não foi possível salvar.')
      setSuccess(message); setReload((value) => value + 1)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro ao salvar.') }
    finally { setBusy(false) }
  }

  const upload = async (file: File | undefined, onDone: (url: string) => void) => {
    if (!file || !data?.development) return
    setUploading(true); setError('')
    try {
      const form = new FormData(); form.set('file', file)
      const response = await fetch(`/api/partner-settlements/proofs?developmentId=${encodeURIComponent(data.development.id)}`, { method: 'POST', body: form })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Não foi possível anexar o comprovante.')
      onDone(payload.url)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro ao anexar.') }
    finally { setUploading(false) }
  }

  const changeMonth = (value: string) => {
    if (!value) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', value)
    if (data?.development) params.set('developmentId', data.development.id)
    setSuccess(''); router.push(`/distributions?${params}`)
  }
  const downloadReport = async (revision?: string) => {
    if (!data?.settlement) return
    setDownloading(true); setError('')
    try {
      const response = await fetch(`/api/partner-settlements/${data.settlement.id}/report${revision ? `?revision=${encodeURIComponent(revision)}` : ''}`, { cache: 'no-store' })
      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || 'Não foi possível gerar o relatório.')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] || `Distribuicao_${month}.pdf`
      document.body.appendChild(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro ao gerar relatório.') }
    finally { setDownloading(false) }
  }
  const blocked = busy || uploading || downloading
  const editable = Boolean(data?.canEdit && data.settlement?.status === 'draft')
  const snapshot = data?.snapshot
  const closed = data?.settlement?.status === 'closed'
  const participantTotal = agreement.participants.reduce((sum, item) => sum + (Number(item.percentage) || 0), 0)
  const paidTooMuch = Boolean(data?.allocations.some((item) => item.paid > item.amount))
  const paymentRecipient = data?.allocations.find((item) => item.id === payment?.participantId)
  const rulesSignature = (items: DistributionParticipant[]) => JSON.stringify(items.map((item) => [item.id, item.kind, item.name, Number(item.percentage), item.pixKey]))
  const rulesChanged = Boolean(snapshot && data?.agreement && rulesSignature(snapshot.participants) !== rulesSignature(data.agreement.participants))
  const periodEnded = month < today().slice(0, 7)
  const patchExpense = (index: number, patch: Partial<ExpenseForm>) => { setDirty(true); setExpenses((items) => items.map((item, current) => index === current ? { ...item, ...patch } : item)) }
  const patchAdjustment = (index: number, patch: Partial<AdjustmentForm>) => { setDirty(true); setAdjustments((items) => items.map((item, current) => index === current ? { ...item, ...patch } : item)) }

  return <div className='space-y-6'>
    <datalist id='expense-categories'><option value='Marketing' /><option value='Alimentação' /><option value='Serviços' /><option value='Taxas' /><option value='Outros' /></datalist>
    <style>{`@media print { body * { visibility: hidden; } #partner-statement, #partner-statement * { visibility: visible; } #partner-statement { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; background: white; color: black; } .partner-no-print { display: none !important; } #partner-statement details > * { display: block !important; } #partner-statement details { break-inside: auto; } #partner-statement tr { break-inside: avoid; } }`}</style>
    <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
      <div><p className='eyebrow'>Financeiro</p><h1 className='page-title'>Distribuição de resultados</h1><p className='page-subtitle'>Apure o resultado do empreendimento, distribua entre os participantes e acompanhe os pagamentos.</p></div>
      <label className='block shrink-0'><span className='mb-2 block text-xs font-semibold uppercase text-muted'>Mês de referência</span><input aria-label='Mês de referência' type='month' min='2000-01' max='2100-12' value={month} disabled={blocked || dirty} onChange={(event) => changeMonth(event.target.value)} className={field} /></label>
    </div>
    {error && <div role='alert' className='rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>{error}<button className='ml-3 font-semibold underline' disabled={blocked} onClick={() => { setSuccess(''); setReload((value) => value + 1) }}>Atualizar dados</button></div>}
    {success && <div role='status' className='rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700'>{success}</div>}
    {loading ? <div role='status' aria-label='Carregando distribuições' className='h-64 animate-pulse rounded-2xl bg-surface-secondary' /> : data?.development ? <>
      <div className='flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-5 py-4'>
        <div><p className='text-xs text-muted'>Empreendimento</p><p className='font-semibold text-foreground'>{data.development.name}</p></div>
        {data.agreement && <div><p className='text-xs text-muted'>Regras para novos meses</p><p className='text-sm font-semibold text-foreground'>{data.agreement.participants.length} participante(s) · {data.agreement.participants.reduce((sum, item) => sum + Number(item.percentage), 0).toLocaleString('pt-BR')}% do resultado</p></div>}
        {data.canEdit && <button className={secondary} disabled={blocked} onClick={() => setAgreementOpen((value) => !value)}>{agreementOpen ? 'Ocultar regras' : 'Configurar distribuição'}</button>}
      </div>
      {agreementOpen && data.canEdit && <form className='panel space-y-5 p-5' onSubmit={(event) => { event.preventDefault(); void mutate({ action: 'agreement', ...agreement, version: data.agreement?.version }, 'Regras salvas. Serão usadas em novos rascunhos.') }}>
        <div><h2 className='text-lg font-semibold text-foreground'>Participantes e regras de distribuição</h2><p className='mt-1 text-sm text-muted'>Configure uma vez por empreendimento. Alterações valem para novos rascunhos; meses já criados preservam as regras originais.</p></div>
        <fieldset disabled={blocked} className='space-y-4'>
          <p className='text-sm text-muted'>Cadastre pessoas ou empresas e o percentual de cada uma sobre o líquido positivo. O restante fica como saldo da operação.</p>
          {agreement.participants.map((participant, index) => <div key={participant.id} className='space-y-3 rounded-xl border border-border p-4'>
            <div className='grid gap-3 sm:grid-cols-[150px_1fr_150px]'>
              <label><span className='mb-1 block text-xs font-semibold text-muted'>Tipo</span><select value={participant.kind} onChange={(event) => setAgreement({ ...agreement, participants: agreement.participants.map((item, current) => current === index ? { ...item, kind: event.target.value as 'person' | 'company' } : item) })} className={field}><option value='person'>Pessoa</option><option value='company'>Empresa</option></select></label>
              <label><span className='mb-1 block text-xs font-semibold text-muted'>Nome do participante</span><input required maxLength={300} value={participant.name} onChange={(event) => setAgreement({ ...agreement, participants: agreement.participants.map((item, current) => current === index ? { ...item, name: event.target.value } : item) })} className={field} /></label>
              <label><span className='mb-1 block text-xs font-semibold text-muted'>Participação (%)</span><input required type='number' min='0.0001' max='100' step='0.0001' value={participant.percentage} onChange={(event) => setAgreement({ ...agreement, participants: agreement.participants.map((item, current) => current === index ? { ...item, percentage: event.target.value } : item) })} className={field} /></label>
            </div>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-end'><label className='flex-1'><span className='mb-1 block text-xs font-semibold text-muted'>Chave Pix (opcional)</span><input maxLength={300} value={participant.pixKey} onChange={(event) => setAgreement({ ...agreement, participants: agreement.participants.map((item, current) => current === index ? { ...item, pixKey: event.target.value } : item) })} className={field} /></label><button type='button' className={secondary} onClick={() => setAgreement({ ...agreement, participants: agreement.participants.filter((_, current) => current !== index) })}>Remover participante</button></div>
          </div>)}
          <button type='button' className={secondary} onClick={() => setAgreement({ ...agreement, participants: [...agreement.participants, { id: crypto.randomUUID(), kind: 'person', name: '', percentage: '', pixKey: '' }] })}>Adicionar participante</button>
          <p role='status' className={`text-sm font-semibold ${participantTotal > 100.00000001 ? 'text-red-700' : 'text-foreground'}`}>Distribuição: {participantTotal.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}% · Saldo da operação: {Math.max(0, 100 - participantTotal).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%{participantTotal > 100.00000001 ? ' — A soma não pode ultrapassar 100%.' : ''}</p>
          <div><h3 className='text-sm font-semibold'>Custos e despesas sugeridos</h3><p className='mt-1 text-xs text-muted'>Sugestões para novos rascunhos, como a mensalidade do sistema. Gastos avulsos, como café da manhã, banners e campanhas, são adicionados apenas no mês em que ocorreram.</p></div>
          {agreement.defaultCosts.map((cost, index) => <div key={index} className='grid gap-2 sm:grid-cols-[1fr_150px_140px_auto]'>
            <input required aria-label={`Descrição do custo sugerido ${index + 1}`} placeholder='Descrição' value={cost.description} onChange={(event) => setAgreement({ ...agreement, defaultCosts: agreement.defaultCosts.map((item, current) => current === index ? { ...item, description: event.target.value } : item) })} className={field} />
            <input aria-label={`Categoria do custo sugerido ${index + 1}`} placeholder='Categoria' maxLength={60} list='expense-categories' value={cost.category || ''} onChange={(event) => setAgreement({ ...agreement, defaultCosts: agreement.defaultCosts.map((item, current) => current === index ? { ...item, category: event.target.value } : item) })} className={field} />
            <input required aria-label={`Valor do custo sugerido ${index + 1}`} type='number' min='0.01' step='0.01' value={cost.amount} onChange={(event) => setAgreement({ ...agreement, defaultCosts: agreement.defaultCosts.map((item, current) => current === index ? { ...item, amount: event.target.value } : item) })} className={field} />
            <button type='button' className={secondary} onClick={() => setAgreement({ ...agreement, defaultCosts: agreement.defaultCosts.filter((_, current) => current !== index) })}>Remover</button>
          </div>)}
          {dirty && <p className='text-sm text-amber-700'>Salve as alterações do rascunho antes de salvar as regras.</p>}
          <div className='flex flex-wrap gap-3'><button type='button' className={secondary} onClick={() => setAgreement({ ...agreement, defaultCosts: [...agreement.defaultCosts, { description: '', amount: '' }] })}>Adicionar custo sugerido</button><button type='submit' disabled={dirty || !agreement.participants.length || participantTotal > 100.00000001} className={primary}>Salvar regras</button></div>
        </fieldset>
      </form>}
      {!data.settlement ? <section className='panel p-8 text-center'><h2 className='text-lg font-semibold text-foreground'>{monthName(month)}</h2><p className='mx-auto mt-2 max-w-xl text-sm text-muted'>{data.agreement ? 'Crie um rascunho para conferir os recebimentos, as comissões pagas e os custos deste mês.' : 'Configure os participantes e suas participações para começar o primeiro fechamento.'}</p>{data.canEdit && data.agreement && <button className={`${primary} mt-5`} disabled={blocked} onClick={() => void mutate({ action: 'create' }, 'Rascunho criado. Confira os custos e o demonstrativo.')}>Criar rascunho do mês</button>}</section> : snapshot && <>
        {data.sourceChanged && <div role='status' className='rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800'>Há mudanças nos dados de origem após este fechamento. O demonstrativo abaixo permanece preservado. Você pode reabrir o mês para corrigir os dados ou registrar um ajuste em um mês posterior.<details className='mt-2'><summary className='cursor-pointer font-semibold'>Conferir dados atuais</summary><p className='mt-2'>Consulte <Link className='underline' href={`/finance?developmentId=${data.development.id}&view=list&status=all&dueFrom=&dueTo=`}>Recebimentos</Link> e <Link className='underline' href={`/commissions?developmentId=${data.development.id}`}>Comissões</Link> para conferir os lançamentos.</p></details></div>}
        <section id='partner-statement' className='panel space-y-6 p-5 sm:p-6'>
          <div className='flex flex-wrap items-start justify-between gap-4'>
            <div><p className='text-xs font-medium uppercase text-muted'>Demonstrativo mensal · {data.development.name}</p><h2 className='mt-1 text-xl font-bold capitalize text-foreground'>{monthName(month)}</h2><p className='mt-1 text-sm text-muted'>{snapshot.participants.length} participante(s) · {snapshot.totalPercentage.toLocaleString('pt-BR')}% distribuídos{data.settlement.closedAt ? ` · Fechado em ${date(data.settlement.closedAt)}` : ' · Rascunho'}</p></div>
            <div className='flex flex-wrap gap-2 partner-no-print'><span className='self-center rounded-full bg-surface-secondary px-3 py-1 text-xs font-semibold text-muted'>{closed ? 'Fechado' : 'Rascunho'}</span><button type='button' className={secondary} disabled={blocked || dirty} onClick={() => void downloadReport()}>{downloading ? 'Gerando PDF...' : closed ? 'Baixar relatório PDF' : 'Baixar prévia em PDF'}</button>{closed && data.canEdit && <button type='button' className={secondary} disabled={blocked} onClick={() => { setError(''); setReopenReason('') }}>Reabrir para editar</button>}</div>
          </div>
          <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
            {[{ label: 'Recebido dos clientes', value: snapshot.receiptsTotal }, { label: 'Comissões pagas', value: snapshot.commissionsTotal }, { label: 'Custos e despesas', value: snapshot.costsTotal }, { label: 'Líquido para dividir', value: snapshot.netAmount }].map((card) => <div key={card.label} className='rounded-xl bg-surface-secondary p-4'><p className='text-xs text-muted'>{card.label}</p><p className='mt-2 text-xl font-bold text-foreground'>{money(card.value)}</p></div>)}
          </div>
          <div className='rounded-2xl border border-emerald-200 bg-emerald-50 p-5'>
            <div className='flex flex-wrap justify-between gap-5'><div><p className='text-sm font-medium text-emerald-800'>Total a distribuir · {snapshot.totalPercentage.toLocaleString('pt-BR')}%</p><p className='mt-1 text-3xl font-bold text-emerald-700'>{money(snapshot.partnerAmount)}</p></div>{data.payment && (closed || data.payment.paid > 0) && <div className='flex flex-wrap gap-6 text-sm'><div><p className='text-emerald-800'>Pago</p><p className='mt-1 font-bold text-emerald-700'>{money(data.payment.paid)}</p></div><div><p className='text-emerald-800'>Saldo a pagar</p><p className='mt-1 font-bold text-emerald-700'>{money(data.payment.remaining)}</p></div><span className='self-start rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-emerald-800'>{snapshot.partnerAmount === 0 ? 'Sem distribuição' : paymentLabel[data.payment.status]}</span></div>}</div>
            <p className='mt-3 text-xs text-emerald-800'>Recebimentos − comissões pagas − custos{snapshot.adjustmentsTotal !== 0 ? ` + ajustes (${money(snapshot.adjustmentsTotal)})` : ''} = líquido. A distribuição é calculada sobre o líquido positivo.</p>
          </div>
          <div className='flex flex-wrap items-baseline justify-between gap-3 rounded-xl border border-border p-4'><div><h3 className='text-sm font-semibold'>Saldo da operação</h3><p className='mt-1 text-xs text-muted'>Parte do resultado que permanece na operação após a distribuição.</p></div><p className='text-xl font-bold text-foreground'>{money(snapshot.operationAmount)}</p></div>
          <div className='space-y-3'><h3 className='font-semibold text-foreground'>Distribuição por participante</h3>{data.allocations.map((item) => <div key={item.id} className='rounded-xl border border-border p-4'><div className='flex flex-wrap items-start justify-between gap-4'><div><p className='font-semibold text-foreground'>{item.name}</p><p className='mt-1 text-xs text-muted'>{item.kind === 'company' ? 'Empresa' : 'Pessoa'} · {item.percentage.toLocaleString('pt-BR')}% do líquido</p>{item.pixKey && <p className='mt-1 break-all text-xs text-muted'>Pix: {item.pixKey}</p>}</div><div className='flex flex-wrap items-center gap-5 text-sm'><div><p className='text-xs text-muted'>Valor devido</p><p className='mt-1 font-semibold'>{money(item.amount)}</p></div><div><p className='text-xs text-muted'>Pago</p><p className='mt-1 font-semibold text-emerald-700'>{money(item.paid)}</p></div><div><p className='text-xs text-muted'>Saldo a pagar</p><p className='mt-1 font-semibold'>{money(item.remaining)}</p></div>{closed && data.canEdit && item.remaining > 0 && <button disabled={blocked} className={primary} onClick={() => { setError(''); setPayment({ paymentId: crypto.randomUUID(), participantId: item.id, amount: String(item.remaining), paidAt: today(), proofUrl: '', notes: '' }) }}>Registrar pagamento</button>}</div></div></div>)}</div>
          {snapshot.netAmount < 0 && <p className='rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800'>O mês tem resultado negativo de {money(snapshot.netAmount)} e não gera distribuição. Esse saldo não é levado automaticamente ao mês seguinte. Caso deva ser compensado, registre um ajuste negativo no fechamento seguinte.</p>}
          {!closed && <p className='text-xs text-muted'>Recebimentos pela data de pagamento registrada na parcela, incluindo baixas parciais; comissões pela data do Pix registrado. Horário de referência: Bahia. Custos e despesas sugeridos precisam ser conferidos antes do fechamento.</p>}
          <details className='rounded-xl border border-border px-4 py-3'><summary className='cursor-pointer text-sm font-semibold'>Recebimentos dos clientes ({snapshot.receipts.length}) · {money(snapshot.receiptsTotal)}</summary><SourceTable items={snapshot.receipts} /></details>
          <details className='rounded-xl border border-border px-4 py-3'><summary className='cursor-pointer text-sm font-semibold'>Comissões pagas ({snapshot.commissions.length}) · {money(snapshot.commissionsTotal)}</summary><SourceTable items={snapshot.commissions} /></details>
          <div className='space-y-3'>
            <div><h3 className='font-semibold text-foreground'>Custos e despesas no mês</h3>{editable && <p className='mt-1 text-xs text-muted'>Lance aqui os gastos deste mês: café da manhã, banners, campanhas e outras despesas. Confira as sugestões das regras e informe a data de pagamento.</p>}</div>
            {editable ? <fieldset disabled={blocked} className='space-y-3 partner-no-print'>
              {expenses.map((cost, index) => <div key={index} className='space-y-2 rounded-xl border border-border p-3'>
                <div className='grid gap-2 sm:grid-cols-[1fr_140px_140px_155px_auto]'>
                  <input aria-label={`Descrição da despesa ${index + 1}`} placeholder='Descrição do custo' maxLength={300} value={cost.description} onChange={(event) => patchExpense(index, { description: event.target.value })} className={field} />
                  <input aria-label={`Categoria da despesa ${index + 1}`} placeholder='Categoria' maxLength={60} list='expense-categories' value={cost.category || ''} onChange={(event) => patchExpense(index, { category: event.target.value })} className={field} />
                  <input aria-label={`Valor da despesa ${index + 1}`} type='number' min='0.01' step='0.01' placeholder='Valor (R$)' value={cost.amount} onChange={(event) => patchExpense(index, { amount: event.target.value })} className={field} />
                  <input aria-label={`Data da despesa ${index + 1}`} type='date' value={cost.paidAt} onChange={(event) => patchExpense(index, { paidAt: event.target.value })} className={field} />
                  <button type='button' className={secondary} onClick={() => { setDirty(true); setExpenses(expenses.filter((_, current) => current !== index)) }}>Remover</button>
                </div>
                <div className='flex flex-wrap items-center gap-3'><label className='cursor-pointer text-xs font-semibold text-primary'>Anexar comprovante<input aria-label={`Comprovante da despesa ${index + 1}`} type='file' accept='.pdf,.png,.jpg,.jpeg,.webp' disabled={blocked} className='mt-1 block max-w-full text-xs font-normal text-muted' onChange={(event) => void upload(event.target.files?.[0], (url) => patchExpense(index, { proofUrl: url }))} /></label><ProofLink url={cost.proofUrl} /></div>
              </div>)}
              <button type='button' className={secondary} onClick={() => { setDirty(true); setExpenses([...expenses, { description: '', amount: '', paidAt: month === today().slice(0, 7) ? today() : `${month}-01`, proofUrl: '' }]) }}>Adicionar despesa</button>
            </fieldset> : <div className='divide-y divide-border'>{snapshot.expenses.length ? snapshot.expenses.map((cost, index) => <div key={index} className='flex flex-wrap items-center justify-between gap-3 py-3 text-sm'><div><p>{cost.description}</p><p className='text-xs text-muted'>{cost.category || 'Outros'} · {date(cost.paidAt)}</p><ProofLink url={cost.proofUrl} /></div><p className='font-semibold'>{money(cost.amount)}</p></div>) : <p className='text-sm text-muted'>Nenhum custo lançado.</p>}</div>}
          </div>
          <div className='space-y-3'>
            <div><h3 className='font-semibold text-foreground'>Ajustes de meses anteriores</h3><p className='mt-1 text-xs text-muted'>Valor positivo aumenta o líquido; negativo reduz. Identifique o mês de origem e explique o motivo. O valor ajusta a base da divisão, antes de aplicar o percentuais dos participantes.</p></div>
            {editable ? <fieldset disabled={blocked} className='space-y-3 partner-no-print'>
              {adjustments.map((adjustment, index) => <div key={index} className='grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_140px_155px_auto]'>
                <input aria-label={`Motivo do ajuste ${index + 1}`} placeholder='Motivo do ajuste' maxLength={300} value={adjustment.description} onChange={(event) => patchAdjustment(index, { description: event.target.value })} className={field} />
                <input aria-label={`Valor do ajuste ${index + 1}`} type='number' step='0.01' placeholder='Valor (+ ou −)' value={adjustment.amount} onChange={(event) => patchAdjustment(index, { amount: event.target.value })} className={field} />
                <input aria-label={`Mês de origem do ajuste ${index + 1}`} type='month' value={adjustment.referenceMonth} onChange={(event) => patchAdjustment(index, { referenceMonth: event.target.value })} className={field} />
                <button type='button' className={secondary} onClick={() => { setDirty(true); setAdjustments(adjustments.filter((_, current) => current !== index)) }}>Remover</button>
              </div>)}
              <button type='button' className={secondary} onClick={() => { setDirty(true); setAdjustments([...adjustments, { description: '', amount: '', referenceMonth: '' }]) }}>Adicionar ajuste</button>
            </fieldset> : <div className='divide-y divide-border'>{snapshot.adjustments.length ? snapshot.adjustments.map((adjustment, index) => <div key={index} className='flex justify-between gap-3 py-3 text-sm'><div><p>{adjustment.description}</p><p className='text-xs text-muted'>Origem: {monthName(adjustment.referenceMonth)}</p></div><p className='whitespace-nowrap font-semibold'>{money(adjustment.amount)}</p></div>) : <p className='text-sm text-muted'>Nenhum ajuste lançado.</p>}</div>}
          </div>
          {(closed || data.settlement.payments.length > 0) && <div className='space-y-3 border-t border-border pt-5'>
            <h3 className='font-semibold text-foreground'>Pagamentos aos participantes</h3>
            {data.settlement.payments.length ? <div className='divide-y divide-border'>{data.settlement.payments.map((item) => <div key={item.id} className='flex flex-wrap justify-between gap-3 py-3 text-sm'><div><p className='font-medium'>{item.participantName || snapshot.participants.find((participant) => participant.id === item.participantId)?.name}</p><p className='text-xs text-muted'>Pix em {date(item.paidAt)}</p>{item.notes && <p className='mt-1 text-xs text-muted'>{item.notes}</p>}<ProofLink url={item.proofUrl} /></div><p className='font-semibold text-emerald-700'>{money(Number(item.amount))}</p></div>)}</div> : <p className='text-sm text-muted'>Nenhum pagamento registrado.</p>}
          </div>}
          {editable && rulesChanged && <div className='rounded-xl border border-border p-4 partner-no-print'><p className='text-sm text-muted'>As regras foram alteradas após a criação deste mês. Você pode atualizar os participantes e percentuais neste rascunho. As despesas permanecem como você lançou; participantes já pagos precisam ser mantidos.</p><button disabled={blocked || dirty} className={`${secondary} mt-3`} onClick={() => void mutate({ action: 'applyAgreement', version: data.settlement!.version }, 'Regras atualizadas neste rascunho.')}>Usar regras atualizadas</button></div>}
          {editable && <div className='space-y-3 border-t border-border pt-5 partner-no-print'>
            {data.payment && data.payment.paid > 0 && <p className='rounded-xl bg-amber-50 p-3 text-sm text-amber-800'>Este mês já tem {money(data.payment.paid)} pagos aos participantes. Os pagamentos foram preservados. A nova distribuição de cada participante precisa cobrir o que ele já recebeu.</p>}
            {paidTooMuch && <p role='alert' className='text-sm font-semibold text-red-700'>A nova distribuição de um participante está abaixo do que ele já recebeu. Confira os ajustes antes de fechar.</p>}
            {dirty && <p role='status' className='text-sm font-medium text-amber-700'>Há alterações não salvas. Salve o rascunho para recalcular o demonstrativo.</p>}
            {!periodEnded && <p className='text-sm text-muted'>Você pode preparar o rascunho agora. O fechamento fica disponível após o fim do mês.</p>}
            <div className='flex flex-wrap gap-3'><button disabled={blocked || !dirty} className={secondary} onClick={() => void mutate({ action: 'save', version: data.settlement!.version, expenses, adjustments }, 'Rascunho salvo e demonstrativo recalculado.')}>Salvar rascunho</button><button disabled={blocked || dirty || !periodEnded || paidTooMuch} className={primary} onClick={() => setConfirmClose(true)}>Revisar e fechar mês</button></div>
          </div>}
        </section>
      </>}
      {data.settlement && data.settlement.revisions.length > 0 && <section className='panel p-5'><h2 className='text-lg font-semibold text-foreground'>Versões anteriores deste mês</h2><div className='mt-3 divide-y divide-border'>{data.settlement.revisions.map((revision) => <div key={revision.id} className='flex flex-wrap items-center justify-between gap-3 py-4'><div><p className='text-sm font-semibold'>Versão {revision.number} · fechada em {date(revision.closedAt)}</p><p className='mt-1 text-xs text-muted'>Reaberta em {date(revision.createdAt)}: {revision.reason}</p></div><button disabled={blocked} className={secondary} onClick={() => void downloadReport(revision.id)}>Baixar PDF desta versão</button></div>)}</div></section>}
      {data.history?.length > 0 && <section className='panel p-5'><h2 className='text-lg font-semibold text-foreground'>Histórico do empreendimento</h2><div className='mt-3 divide-y divide-border'>{data.history.map((item) => <button key={item.id} disabled={blocked || dirty} onClick={() => changeMonth(item.month)} className={`flex w-full flex-wrap items-center justify-between gap-3 px-2 py-4 text-left hover:bg-surface-secondary disabled:opacity-50 ${item.month === month ? 'bg-surface-secondary' : ''}`}><div><p className='text-sm font-semibold capitalize'>{monthName(item.month)}</p><p className='text-xs text-muted'>{item.participantCount} participante(s) · {item.status === 'draft' ? 'Rascunho' : `Fechado · ${item.partnerAmount === 0 ? 'Sem distribuição' : paymentLabel[item.payment!.status]}`}</p></div>{item.status === 'closed' && <div className='text-right'><p className='text-sm font-semibold'>{money(Number(item.partnerAmount))}</p><p className='text-xs text-muted'>Saldo: {money(item.payment!.remaining)}</p></div>}</button>)}</div></section>}
    </> : !error && <div className='panel p-8 text-center text-sm text-muted'>Nenhum empreendimento com acesso financeiro disponível.</div>}
    {confirmClose && snapshot && data?.settlement && <div role='dialog' aria-modal='true' aria-labelledby='close-title' className='fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4'>
      <div className='w-full max-w-lg space-y-5 rounded-2xl bg-surface p-6 shadow-2xl'><h2 id='close-title' className='text-xl font-bold'>Fechar {monthName(month)}?</h2><p className='text-sm text-muted'>O demonstrativo de {data.development?.name} ficará preservado, com distribuição de <strong className='text-foreground'>{money(snapshot.partnerAmount)}</strong> entre {snapshot.participants.length} participante(s). Confira os custos e despesas e as datas. Se precisar corrigir depois, você poderá reabrir o mês com uma justificativa, preservando esta versão no histórico.</p>{error && <p role='alert' className='text-sm text-red-700'>{error}</p>}<div className='flex justify-end gap-3'><button className={secondary} disabled={blocked} onClick={() => setConfirmClose(false)}>Voltar</button><button className={primary} disabled={blocked} onClick={() => void mutate({ action: 'close', version: data.settlement!.version, previewToken: data.previewToken }, 'Mês fechado. O demonstrativo está preservado para consulta e pagamento.')}>{busy ? 'Fechando...' : 'Confirmar fechamento'}</button></div></div>
    </div>}
    {reopenReason !== null && data?.settlement && <div role='dialog' aria-modal='true' aria-labelledby='reopen-title' className='fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4'><form className='w-full max-w-lg space-y-5 rounded-2xl bg-surface p-6 shadow-2xl' onSubmit={(event) => { event.preventDefault(); void mutate({ action: 'reopen', version: data.settlement!.version, reason: reopenReason }, 'Mês reaberto para edição. A versão anterior e os pagamentos foram preservados.') }}><h2 id='reopen-title' className='text-xl font-bold'>Reabrir {monthName(month)}?</h2><p className='text-sm text-muted'>A versão atual ficará no histórico. Você poderá editar custos, despesas e ajustes e conferir os dados atualizados de recebimentos e comissões. Os Pix já registrados serão mantidos.</p>{error && <p role='alert' className='text-sm text-red-700'>{error}</p>}<label className='block'><span className='mb-2 block text-sm font-semibold'>Motivo da reabertura</span><textarea required maxLength={2000} value={reopenReason} disabled={blocked} onChange={(event) => setReopenReason(event.target.value)} className={field} /></label><div className='flex justify-end gap-3'><button type='button' className={secondary} disabled={blocked} onClick={() => setReopenReason(null)}>Cancelar</button><button type='submit' className={primary} disabled={blocked || !reopenReason.trim()}>{busy ? 'Reabrindo...' : 'Reabrir para editar'}</button></div></form></div>}
    {payment && data?.settlement && <div role='dialog' aria-modal='true' aria-labelledby='payment-title' className='fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4'>
      <form className='my-auto w-full max-w-lg space-y-4 rounded-2xl bg-surface p-6 shadow-2xl' onSubmit={(event) => { event.preventDefault(); void mutate({ action: 'payment', version: data.settlement!.version, ...payment }, 'Pagamento registrado. Saldo do participante atualizado.') }}>
        <h2 id='payment-title' className='text-xl font-bold'>Registrar pagamento ao participante</h2><p className='text-sm text-muted'>Registre o Pix já realizado para {paymentRecipient?.name}. Saldo: {money(paymentRecipient?.remaining ?? 0)}.</p>
        {error && <p role='alert' className='text-sm text-red-700'>{error}</p>}
        <fieldset disabled={blocked} className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'><label><span className='mb-2 block text-sm font-semibold'>Valor pago</span><input type='number' required min='0.01' step='0.01' max={paymentRecipient?.remaining} value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} className={field} /></label><label><span className='mb-2 block text-sm font-semibold'>Data do Pix</span><input type='date' required max={today()} value={payment.paidAt} onChange={(event) => setPayment({ ...payment, paidAt: event.target.value })} className={field} /></label></div>
          <label className='block'><span className='mb-2 block text-sm font-semibold'>Comprovante (opcional)</span><input type='file' accept='.pdf,.png,.jpg,.jpeg,.webp' onChange={(event) => void upload(event.target.files?.[0], (url) => setPayment((current) => current ? { ...current, proofUrl: url } : null))} className='block w-full text-sm text-muted' /><span className='mt-1 block text-xs text-muted'>PDF ou imagem de até 5 MB. Acesso restrito ao financeiro.</span></label><ProofLink url={payment.proofUrl} />
          <label className='block'><span className='mb-2 block text-sm font-semibold'>Observação (opcional)</span><textarea maxLength={2000} value={payment.notes} onChange={(event) => setPayment({ ...payment, notes: event.target.value })} className={field} /></label>
          {uploading && <p className='text-sm text-muted'>Anexando comprovante...</p>}
        </fieldset>
        <div className='flex justify-end gap-3'><button type='button' disabled={blocked} className={secondary} onClick={() => setPayment(null)}>Cancelar</button><button type='submit' disabled={blocked} className={primary}>{busy ? 'Salvando...' : 'Registrar pagamento'}</button></div>
      </form>
    </div>}
  </div>
}

export default function Distributions() { return <Suspense fallback={<div className='h-64 animate-pulse rounded-2xl bg-surface-secondary' />}><Content /></Suspense> }
