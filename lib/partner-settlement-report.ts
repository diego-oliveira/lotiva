import {
  AlignmentType, BorderStyle, Document, Footer, Header, PageNumber, Packer,
  Paragraph, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx'
import { convertDocxToPdf } from '@/lib/docxDocuments'
import { paymentSummary, participantSummaries, type SettlementSnapshot } from '@/lib/partner-settlements'

type Payment = { participantId?: string | null; participantName?: string; amount: number; paidAt: string; notes?: string | null; proofUrl?: string | null }
export type SettlementReportInput = {
  snapshot: SettlementSnapshot
  payments: Payment[]
  status: 'draft' | 'closed' | 'archived'
  version: number
  closedAt?: string | null
  reason?: string
  generatedAt?: Date
}
const ink = '173B36'
const muted = '64726D'
const green = '08765B'
const line = 'DEE7E2'
const clean = (value: string) => value.replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\u00a0/g, ' ')
const money = (value: number) => clean(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value))
const date = (value: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia' }).format(new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value))
const monthLabel = (value: string) => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Bahia' }).format(new Date(`${value}-15T12:00:00-03:00`))
const paragraph = (value: string, options: { bold?: boolean; size?: number; color?: string; after?: number; before?: number; keepNext?: boolean; alignment?: typeof AlignmentType[keyof typeof AlignmentType] } = {}) => new Paragraph({
  children: [new TextRun({ text: clean(value), bold: options.bold, size: options.size ?? 20, color: options.color ?? ink })],
  spacing: { after: options.after ?? 100, before: options.before ?? 0 }, keepNext: options.keepNext, alignment: options.alignment,
})
const heading = (value: string) => paragraph(value, { bold: true, size: 25, before: 280, after: 130, keepNext: true })

function table(headers: string[], rows: string[][], widths: number[]) {
  const cell = (value: string, index: number, header = false) => new TableCell({
    width: { size: widths[index], type: WidthType.PERCENTAGE },
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    shading: header ? { fill: 'EDF4F0' } : undefined,
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.SINGLE, size: 4, color: line }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
    children: [paragraph(value, { bold: header, size: header ? 18 : 19, color: header ? muted : ink, after: 0, alignment: index === headers.length - 1 ? AlignmentType.RIGHT : AlignmentType.LEFT })],
  })
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: widths.map((width) => Math.round(10100 * width / 100)),
    rows: [new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((value, index) => cell(value, index, true)) }),
      ...rows.map((row) => new TableRow({ cantSplit: true, children: row.map((value, index) => cell(value, index)) }))],
  })
}

export async function createSettlementReportDocx(input: SettlementReportInput) {
  const { snapshot, payments } = input
  const payment = paymentSummary(snapshot.partnerAmount, payments)
  const allocations = participantSummaries(snapshot, payments)
  const recipientName = (item: Payment) => item.participantName || snapshot.participants.find((participant) => participant.id === (item.participantId || 'legacy'))?.name || 'Participante'
  const generatedAt = input.generatedAt ?? new Date()
  const status = input.status === 'draft' ? 'PRÉVIA - RASCUNHO' : input.status === 'archived' ? 'VERSÃO ANTERIOR' : 'FECHAMENTO CONFIRMADO'
  const body: (Paragraph | Table)[] = [
    paragraph('DISTRIBUIÇÃO DE RESULTADOS', { bold: true, size: 36, after: 90 }),
    paragraph(monthLabel(snapshot.month), { size: 26, color: green, after: 200 }),
    paragraph(snapshot.developmentName, { bold: true, size: 25, after: 80 }),
    paragraph(`${snapshot.participants.length} participante(s) | Participação total: ${snapshot.totalPercentage.toLocaleString('pt-BR')}%`, { size: 21, after: 70 }),
    paragraph(`${status} | Versão ${input.version}${input.closedAt ? ` | Fechado em ${date(input.closedAt)}` : ''}`, { size: 18, color: muted, after: 200 }),
  ]
  if (input.status === 'draft') body.push(paragraph('Prévia para conferência. Este mês ainda pode ser editado e os valores não constituem um fechamento confirmado.', { size: 19, color: '8C5B0A', after: 170 }))
  if (input.reason) body.push(paragraph(`Motivo da reabertura: ${input.reason}`, { size: 19, color: muted, after: 170 }))
  body.push(heading('Resumo do mês'), table(['Apuração', 'Valor'], [
    ['Recebimentos dos clientes', money(snapshot.receiptsTotal)],
    ['(-) Comissões pagas', money(snapshot.commissionsTotal)],
    ['(-) Custos e despesas', money(snapshot.costsTotal)],
    ['(+/-) Ajustes de meses anteriores', money(snapshot.adjustmentsTotal)],
    ['Líquido para dividir', money(snapshot.netAmount)],
  ], [74, 26]))
  body.push(new Paragraph({ spacing: { before: 220, after: 130 }, shading: { fill: 'E7F4ED' }, children: [
    new TextRun({ text: `TOTAL A DISTRIBUIR (${snapshot.totalPercentage.toLocaleString('pt-BR')}%)    `, size: 22, bold: true, color: green }),
    new TextRun({ text: money(snapshot.partnerAmount), size: 30, bold: true, color: green }),
  ] }))
  body.push(paragraph(`Pago aos participantes: ${money(payment.paid)} | Saldo a pagar: ${money(payment.remaining)}`, { size: 20, after: 140 }))
  body.push(paragraph(`Saldo da operação: ${money(snapshot.operationAmount)}`, { bold: true, size: 22, after: 150 }))
  body.push(heading('Distribuição por participante'), table(['Participante', '%', 'Devido', 'Pago', 'Saldo'], allocations.map((item) => [item.name + (item.kind === 'company' ? ' (empresa)' : ''), item.percentage.toLocaleString('pt-BR') + '%', money(item.amount), money(item.paid), money(item.remaining)]), [36, 10, 18, 18, 18]))
  if (snapshot.netAmount < 0) body.push(paragraph('O mês teve resultado negativo e não gera distribuição. A compensação desse saldo em outro mês depende de um ajuste identificado.', { size: 18, color: '8C5B0A' }))
  if (allocations.some((item) => item.paid > item.amount)) body.push(paragraph('A prévia de um participante está abaixo do valor já pago a ele. Revise os ajustes antes de confirmar o fechamento.', { size: 18, color: '8C5B0A' }))
  body.push(paragraph('Base: recebimentos pela data de pagamento da parcela; comissões pela data do pagamento registrado; custos pagos no mês. Período mensal no horário da Bahia. Os percentuais incidem sobre o líquido positivo. O restante fica na operação. Centavos são distribuídos sem exceder o total disponível.', { size: 17, color: muted, after: 100 }))

  body.push(heading(`Recebimentos dos clientes (${snapshot.receipts.length})`))
  body.push(snapshot.receipts.length ? table(['Cliente / venda / parcela', 'Pagamento', 'Valor recebido'], [...snapshot.receipts].sort((a, b) => a.paidAt.localeCompare(b.paidAt)).map((item) => [item.description, date(item.paidAt), money(item.amount)]), [60, 19, 21]) : paragraph('Nenhum recebimento no período.', { color: muted }))
  body.push(heading(`Comissões pagas (${snapshot.commissions.length})`))
  body.push(snapshot.commissions.length ? table(['Corretor / lote', 'Pagamento', 'Valor pago'], [...snapshot.commissions].sort((a, b) => a.paidAt.localeCompare(b.paidAt)).map((item) => [item.description, date(item.paidAt), money(item.amount)]), [60, 19, 21]) : paragraph('Nenhuma comissão paga no período.', { color: muted }))
  body.push(heading(`Custos e despesas (${snapshot.expenses.length})`))
  body.push(snapshot.expenses.length ? table(['Descrição / categoria', 'Pagamento', 'Valor'], snapshot.expenses.map((item) => [item.description + ' / ' + (item.category || 'Outros'), date(item.paidAt), money(item.amount)]), [60, 19, 21]) : paragraph('Nenhum custo ou despesa lançado.', { color: muted }))
  body.push(heading('Ajustes de meses anteriores'))
  body.push(snapshot.adjustments.length ? table(['Motivo', 'Mês de origem', 'Ajuste na base'], snapshot.adjustments.map((item) => [item.description, item.referenceMonth.split('-').reverse().join('/'), money(item.amount)]), [60, 19, 21]) : paragraph('Nenhum ajuste lançado.', { color: muted }))
  body.push(heading('Pagamentos aos participantes'))
  body.push(payments.length ? table(['Participante / forma', 'Pagamento', 'Valor'], [...payments].sort((a, b) => a.paidAt.localeCompare(b.paidAt)).map((item) => [recipientName(item) + ' / Pix', date(item.paidAt), money(item.amount)]), [60, 19, 21]) : paragraph('Nenhum Pix registrado até a emissão deste relatório.', { color: muted }))
  for (const item of payments.filter((item) => item.notes)) body.push(paragraph(`Observação do Pix para ${recipientName(item)} em ${date(item.paidAt)}: ${item.notes}`, { size: 18, color: muted, before: 110 }))
  body.push(paragraph('Os comprovantes anexados podem ser consultados no sistema por usuários autorizados do financeiro.', { size: 17, color: muted, before: 160 }))
  body.push(paragraph(`Emitido em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bahia' }).format(generatedAt)} (Bahia).`, { size: 17, color: muted, before: 160 }))

  const document = new Document({
    creator: 'Lotiva', title: `Distribuição de resultados - ${snapshot.month}`, description: `Distribuição mensal de ${snapshot.developmentName}`,
    styles: { default: { document: { run: { font: 'Arial', size: 20, color: ink }, paragraph: { spacing: { line: 265 } } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 900, right: 900, header: 450, footer: 450 } } },
      headers: { default: new Header({ children: [paragraph('LOTIVA  |  FINANCEIRO', { bold: true, size: 17, color: green, after: 80 })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Distribuição de resultados  |  Página ', size: 16, color: muted }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: muted }), new TextRun({ text: ' de ', size: 16, color: muted }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: muted })] })] }) },
      children: body,
    }],
  })
  return Packer.toBuffer(document)
}

export async function createSettlementReportPdf(input: SettlementReportInput) {
  return convertDocxToPdf(await createSettlementReportDocx(input))
}
