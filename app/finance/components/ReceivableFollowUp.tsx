'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

type Props = {
  receivableId: string
  clientName: string
  email: string
  developmentName: string
  installment: string
  dueDate: string
  amount: number
  overdue: boolean
  boletoGenerated: boolean
  boletoSent: boolean
  boletoUrl?: string | null
  lastContact?: { category: string; channel: string; deliveryStatus: string; createdAt: string; userName: string | null } | null
}

const currency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const date = (value: string) => new Date(value).toLocaleDateString('pt-BR')

export default function ReceivableFollowUp(props: Props) {
  const router = useRouter()
  const [channel, setChannel] = useState('whatsapp')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const message = useMemo(() => {
    const greeting = `Olá, ${props.clientName}!`
    const parcel = `${props.installment} do ${props.developmentName}`
    if (props.overdue) {
      return `${greeting} identificamos que ${parcel}, no valor de ${currency(props.amount)}, venceu em ${date(props.dueDate)} e ainda consta em aberto. Poderia nos informar, por favor, se o pagamento já foi realizado ou quando pretende realizá-lo?${props.boletoUrl ? `\n\nSegue o boleto atualizado: ${props.boletoUrl}` : ''}\n\nSe já pagou, pode desconsiderar esta mensagem.`
    }
    return `${greeting} segue o boleto de ${parcel}, no valor de ${currency(props.amount)}, com vencimento em ${date(props.dueDate)}.${props.boletoUrl ? `\n\n${props.boletoUrl}` : ''}\n\nFicamos à disposição.`
  }, [props])

  const recordContact = async () => {
    setBusy(true)
    setFeedback('')
    try {
      const response = await fetch(`/api/receivables/${props.receivableId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: props.overdue ? 'overdue' : 'boleto', channel, message }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Não foi possível registrar o contato.')
      setFeedback('Contato registrado.')
      router.refresh()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível registrar o contato.')
    } finally {
      setBusy(false)
    }
  }

  const copyMessage = async () => {
    await navigator.clipboard.writeText(message)
    setFeedback('Mensagem copiada. Registre o contato depois de enviar.')
  }

  const emailHref = `mailto:${encodeURIComponent(props.email)}?subject=${encodeURIComponent(props.overdue ? 'Parcela em aberto' : 'Boleto da sua parcela')}&body=${encodeURIComponent(message)}`
  const channelLabel: Record<string, string> = { email: 'e-mail', whatsapp: 'WhatsApp', phone: 'telefone', other: 'outro canal' }

  return (
    <div className='mt-3 space-y-2 rounded-xl border border-border bg-background p-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-xs font-semibold text-foreground'>
          {props.overdue ? 'Cobrança de inadimplência' : props.boletoGenerated ? props.boletoSent ? 'Boleto enviado' : 'Boleto gerado · envio pendente' : 'Boleto ainda não gerado'}
        </p>
        {props.lastContact
          ? <span className={`text-[11px] ${props.lastContact.deliveryStatus === 'failed' ? 'text-red-700' : 'text-muted'}`}>{props.lastContact.deliveryStatus === 'failed' ? 'Falha no último envio' : 'Último contato'} ({props.lastContact.category === 'boleto' ? 'boleto' : 'cobrança'}): {date(props.lastContact.createdAt)} · {channelLabel[props.lastContact.channel] ?? props.lastContact.channel} · {props.lastContact.userName ?? 'Lotiva automático'}</span>
          : <span className='text-[11px] text-amber-700'>Nenhum contato registrado</span>}
      </div>
      {(props.boletoGenerated || props.overdue) && (
        <>
          <div className='flex flex-wrap gap-2'>
            <button type='button' onClick={copyMessage} className='rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-secondary'>Copiar mensagem</button>
            <a href={emailHref} className='rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-secondary'>Abrir e-mail</a>
            <select value={channel} onChange={(event) => setChannel(event.target.value)} aria-label='Canal do contato' className='rounded-lg border border-border bg-surface px-2 py-2 text-xs text-foreground'>
              <option value='whatsapp'>WhatsApp</option><option value='email'>E-mail</option><option value='phone'>Telefone</option><option value='other'>Outro</option>
            </select>
            <button type='button' disabled={busy} onClick={recordContact} className='rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50'>{busy ? 'Registrando…' : 'Registrar contato'}</button>
          </div>
          {feedback && <p role='status' className='text-xs text-muted'>{feedback}</p>}
        </>
      )}
    </div>
  )
}
