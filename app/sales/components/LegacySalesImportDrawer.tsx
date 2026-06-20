'use client'

import { useState } from 'react'
import FormDrawer from '@/app/components/FormDrawer'

type LegacySaleDraft = {
  blockIdentifier: string
  lotIdentifier: string
  clientName: string
  clientEmail: string
  clientCpf: string
  totalValue: number
  downPayment: number
  installmentCount: number
  installmentValue: number
  firstDueDate: string
  downPaymentPaid: boolean
  paidInstallments: number
}

type LegacySalesImportDrawerProps = {
  developmentId: string
  isOpen: boolean
  onClose: () => void
  onImported: (count: number) => Promise<void>
}

type CsvRow = Record<string, string>

const csvTemplate = [
  'quadra;lote;cliente_nome;cliente_email;cliente_cpf;valor_venda;entrada;parcelas;valor_parcela;primeiro_vencimento;entrada_paga;parcelas_pagas',
  'A;01;Maria Silva;maria@example.com;12345678900;90000;9000;120;675;2026-07-10;sim;3',
  'A;02;Joao Santos;joao@example.com;98765432100;85000;8500;100;765;2026-08-10;nao;0',
].join('\n')

const aliases = {
  blockIdentifier: ['quadra', 'block'],
  lotIdentifier: ['lote', 'lot', 'numero', 'identificador'],
  clientName: ['cliente_nome', 'clientenome', 'nome', 'cliente'],
  clientEmail: ['cliente_email', 'clienteemail', 'email'],
  clientCpf: ['cliente_cpf', 'clientecpf', 'cpf', 'documento', 'cpfcnpj'],
  totalValue: ['valor_venda', 'valorvenda', 'valor_total', 'valortotal', 'total'],
  downPayment: ['entrada', 'valor_entrada', 'valorentrada'],
  installmentCount: ['parcelas', 'numero_parcelas', 'numeroparcelas', 'quantidade_parcelas'],
  installmentValue: ['valor_parcela', 'valorparcela', 'parcela'],
  firstDueDate: ['primeiro_vencimento', 'primeirovencimento', 'vencimento'],
  downPaymentPaid: ['entrada_paga', 'entradapaga'],
  paidInstallments: ['parcelas_pagas', 'parcelaspagas', 'pagas'],
}

function normalizeKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function splitCsvLine(line: string, delimiter: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

function detectDelimiter(headerLine: string) {
  return [';', ',', '\t']
    .map((delimiter) => ({ delimiter, count: headerLine.split(delimiter).length }))
    .sort((left, right) => right.count - left.count)[0].delimiter
}

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return { rows: [], errors: ['O CSV precisa ter cabecalho e pelo menos uma venda.'] }
  const delimiter = detectDelimiter(lines[0])
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeKey)
  return {
    rows: lines.slice(1).map((line) => {
      const cells = splitCsvLine(line, delimiter)
      return headers.reduce<CsvRow>((row, header, index) => {
        row[header] = cells[index] ?? ''
        return row
      }, {})
    }),
    errors: [],
  }
}

function getValue(row: CsvRow, names: string[]) {
  for (const name of names) {
    const value = row[normalizeKey(name)]
    if (value !== undefined && value.trim()) return value.trim()
  }
  return ''
}

function parseNumber(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, '')
  if (!normalized) return 0
  const comma = normalized.lastIndexOf(',')
  const dot = normalized.lastIndexOf('.')
  if (comma > dot) return Number(normalized.replace(/\./g, '').replace(',', '.')) || 0
  if (dot > comma) return Number(normalized.replace(/,/g, '')) || 0
  return Number(normalized) || 0
}

function parseBoolean(value: string) {
  return ['sim', 's', 'true', '1', 'paga', 'pago', 'yes'].includes(normalizeKey(value))
}

function normalizeDocument(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length <= 11) return digits.padStart(11, '0')
  if (digits.length <= 14) return digits.padStart(14, '0')
  return digits
}

function parseLegacySalesCsv(text: string) {
  const parsed = parseCsv(text)
  if (parsed.errors.length > 0) return { drafts: [], errors: parsed.errors }
  const errors: string[] = []
  const drafts = parsed.rows.map((row, index) => {
    const line = index + 2
    const draft = {
      blockIdentifier: getValue(row, aliases.blockIdentifier),
      lotIdentifier: getValue(row, aliases.lotIdentifier),
      clientName: getValue(row, aliases.clientName),
      clientEmail: getValue(row, aliases.clientEmail).toLowerCase(),
      clientCpf: normalizeDocument(getValue(row, aliases.clientCpf)),
      totalValue: parseNumber(getValue(row, aliases.totalValue)),
      downPayment: parseNumber(getValue(row, aliases.downPayment)),
      installmentCount: Math.trunc(parseNumber(getValue(row, aliases.installmentCount))),
      installmentValue: parseNumber(getValue(row, aliases.installmentValue)),
      firstDueDate: getValue(row, aliases.firstDueDate),
      downPaymentPaid: parseBoolean(getValue(row, aliases.downPaymentPaid)),
      paidInstallments: Math.trunc(parseNumber(getValue(row, aliases.paidInstallments))),
    }
    if (!draft.blockIdentifier) errors.push(`Linha ${line}: quadra obrigatoria.`)
    if (!draft.lotIdentifier) errors.push(`Linha ${line}: lote obrigatorio.`)
    if (!draft.clientName) errors.push(`Linha ${line}: cliente_nome obrigatorio.`)
    if (!draft.clientEmail) errors.push(`Linha ${line}: cliente_email obrigatorio.`)
    if (draft.totalValue <= 0) errors.push(`Linha ${line}: valor_venda deve ser maior que zero.`)
    if (draft.installmentCount > 0 && !draft.firstDueDate) errors.push(`Linha ${line}: primeiro_vencimento obrigatorio.`)
    if (draft.paidInstallments > draft.installmentCount) errors.push(`Linha ${line}: parcelas_pagas maior que parcelas.`)
    return draft
  })
  return { drafts, errors }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function LegacySalesImportDrawer({
  developmentId,
  isOpen,
  onClose,
  onImported,
}: LegacySalesImportDrawerProps) {
  const [drafts, setDrafts] = useState<LegacySaleDraft[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const downloadTemplate = () => {
    const blob = new Blob([csvTemplate], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'modelo-vendas-legadas.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const importCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const result = parseLegacySalesCsv(await file.text())
    if (result.errors.length > 0) {
      setErrors(result.errors)
      return
    }
    setDrafts(result.drafts)
    setErrors([])
  }

  const submit = async () => {
    if (!developmentId) {
      setErrors(['Selecione um empreendimento antes de importar vendas.'])
      return
    }
    if (drafts.length === 0) {
      setErrors(['Importe um CSV antes de continuar.'])
      return
    }

    try {
      setSaving(true)
      setErrors([])
      const response = await fetch('/api/sales/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ developmentId, sales: drafts }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setErrors(payload.errors || [payload.error || 'Nao foi possivel importar as vendas.'])
        return
      }
      await onImported(payload.sales?.length ?? drafts.length)
      setDrafts([])
      onClose()
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Nao foi possivel importar as vendas.'])
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDrawer
      isOpen={isOpen}
      title='Importar vendas legadas'
      description='Crie vendas e agenda financeira para lotes vendidos antes da Lotiva.'
      onClose={onClose}
      widthClassName='max-w-6xl'
    >
      <div className='space-y-6'>
        {errors.length > 0 && (
          <div className='rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>
            <p className='font-semibold'>Revise a importacao</p>
            <ul className='mt-2 list-disc space-y-1 pl-5'>
              {errors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          </div>
        )}

        <section className='rounded-2xl border border-border bg-surface-secondary p-5'>
          <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
            <div>
              <h3 className='text-base font-semibold text-foreground'>CSV de vendas</h3>
              <p className='mt-1 text-sm text-muted'>A importacao nao gera contrato automaticamente. Ela cria cliente, venda, entrada e parcelas.</p>
            </div>
            <div className='flex flex-col gap-2 sm:flex-row'>
              <button type='button' onClick={downloadTemplate} className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-background'>
                Baixar modelo
              </button>
              <label className='cursor-pointer rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-primary-strong'>
                Importar CSV
                <input type='file' accept='.csv,text/csv' onChange={importCsv} className='sr-only' />
              </label>
            </div>
          </div>
        </section>

        {drafts.length > 0 && (
          <section className='overflow-hidden rounded-2xl border border-border bg-surface'>
            <div className='border-b border-border bg-surface-secondary px-5 py-4'>
              <h3 className='text-base font-semibold text-foreground'>{drafts.length} venda(s) na pre-visualizacao</h3>
            </div>
            <div className='overflow-x-auto'>
              <table className='min-w-full divide-y divide-border text-sm'>
                <thead className='bg-surface-secondary'>
                  <tr className='text-left text-xs font-semibold uppercase text-muted'>
                    <th className='px-4 py-3'>Lote</th>
                    <th className='px-4 py-3'>Cliente</th>
                    <th className='px-4 py-3'>Valor</th>
                    <th className='px-4 py-3'>Entrada</th>
                    <th className='px-4 py-3'>Parcelas</th>
                    <th className='px-4 py-3'>Pagas</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-border'>
                  {drafts.map((draft, index) => (
                    <tr key={`${draft.blockIdentifier}-${draft.lotIdentifier}-${index}`}>
                      <td className='whitespace-nowrap px-4 py-3 font-semibold text-foreground'>Quadra {draft.blockIdentifier}, Lote {draft.lotIdentifier}</td>
                      <td className='whitespace-nowrap px-4 py-3'>
                        <p className='font-semibold text-foreground'>{draft.clientName}</p>
                        <p className='text-xs text-muted'>{draft.clientEmail}</p>
                      </td>
                      <td className='whitespace-nowrap px-4 py-3'>{formatCurrency(draft.totalValue)}</td>
                      <td className='whitespace-nowrap px-4 py-3'>{formatCurrency(draft.downPayment)} {draft.downPaymentPaid ? '(paga)' : ''}</td>
                      <td className='whitespace-nowrap px-4 py-3'>{draft.installmentCount}x {formatCurrency(draft.installmentValue)}</td>
                      <td className='whitespace-nowrap px-4 py-3'>{draft.paidInstallments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div className='flex justify-end gap-3 border-t border-border pt-6'>
          <button type='button' onClick={onClose} disabled={saving} className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary disabled:opacity-50'>
            Cancelar
          </button>
          <button type='button' onClick={submit} disabled={saving || drafts.length === 0} className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-50'>
            {saving ? 'Importando...' : `Importar ${drafts.length} venda(s)`}
          </button>
        </div>
      </div>
    </FormDrawer>
  )
}
