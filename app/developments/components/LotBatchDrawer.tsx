'use client'

import { useEffect, useMemo, useState } from 'react'
import FormDrawer from '@/app/components/FormDrawer'

type Development = {
  id: string
  name: string
  metrics?: {
    totalLots: number
    availableLots: number
    reservedLots: number
    soldLots: number
    totalValue: number
  }
}

type LotDraft = {
  blockIdentifier: string
  identifier: string
  front: number
  back: number
  leftSide: number
  rightSide: number
  totalArea: number
  price: number
  status: string
}

type LotBatchDrawerProps = {
  development: Development | null
  isOpen: boolean
  onClose: () => void
  onSave: (count: number) => void
}

type CsvRow = Record<string, string>

const defaultForm = {
  blockIdentifier: 'A',
  quantity: 15,
  front: 10,
  back: 10,
  leftSide: 15,
  rightSide: 15,
  totalArea: 150,
  price: 0,
  status: 'available',
}

const statusOptions = [
  { value: 'available', label: 'Disponivel' },
  { value: 'reserved', label: 'Reservado' },
  { value: 'on_hold', label: 'Bloqueado' },
  { value: 'sold', label: 'Vendido' },
] as const

const csvTemplate = [
  'quadra;lote;frente;fundo;lateral_esquerda;lateral_direita;area;valor;status',
  'A;01;10;10;15;15;150;75000;available',
  'A;02;10;10;15;15;150;75000;reserved',
  'A;03;10;10;15;15;150;75000;on_hold',
  'A;04;10;10;15;15;150;75000;sold',
  'B;01;12;12;20;20;240;98000;available',
].join('\n')

const csvColumnAliases = {
  blockIdentifier: ['quadra', 'block', 'blockidentifier'],
  identifier: ['lote', 'lot', 'identificador', 'identifier', 'numero', 'numero_lote'],
  front: ['frente', 'front'],
  back: ['fundo', 'back'],
  leftSide: ['lateralesquerda', 'lateral_esquerda', 'ladoesquerdo', 'lado_esquerdo', 'leftside'],
  rightSide: ['lateraldireita', 'lateral_direita', 'ladodireito', 'lado_direito', 'rightside'],
  totalArea: ['area', 'areatotal', 'area_total', 'totalarea', 'm2'],
  price: ['valor', 'preco', 'preco_base', 'price'],
  status: ['status', 'situacao', 'situacao_lote'],
}

const statusAliases: Record<string, string> = {
  available: 'available',
  disponivel: 'available',
  reserved: 'reserved',
  reservado: 'reserved',
  onhold: 'on_hold',
  on_hold: 'on_hold',
  bloqueado: 'on_hold',
  sold: 'sold',
  vendido: 'sold',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function makeIdentifier(index: number) {
  return String(index + 1).padStart(2, '0')
}

function normalizeCsvKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function detectDelimiter(headerLine: string) {
  const delimiters = [';', ',', '\t']
  return delimiters
    .map((delimiter) => ({ delimiter, count: headerLine.split(delimiter).length }))
    .sort((left, right) => right.count - left.count)[0].delimiter
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

function parseCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())
  if (lines.length < 2) return { rows: [], errors: ['O CSV precisa ter cabecalho e pelo menos um lote.'] }

  const delimiter = detectDelimiter(lines[0])
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeCsvKey)
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, delimiter)
    return headers.reduce<CsvRow>((row, header, index) => {
      row[header] = cells[index] ?? ''
      return row
    }, {})
  })

  return { rows, errors: [] }
}

function getCsvValue(row: CsvRow, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[normalizeCsvKey(alias)]
    if (value !== undefined && value.trim()) return value.trim()
  }
  return ''
}

function parseCsvNumber(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, '')
  if (!normalized) return Number.NaN
  const comma = normalized.lastIndexOf(',')
  const dot = normalized.lastIndexOf('.')

  if (comma > dot) {
    return Number(normalized.replace(/\./g, '').replace(',', '.'))
  }
  if (dot > comma) {
    return Number(normalized.replace(/,/g, ''))
  }
  return Number(normalized)
}

function parseCsvStatus(value: string) {
  if (!value.trim()) return defaultForm.status
  return statusAliases[normalizeCsvKey(value)] ?? ''
}

function parseLotCsv(text: string) {
  const parsed = parseCsv(text)
  if (parsed.errors.length > 0) return { drafts: [], blockIdentifier: '', blockCount: 0, errors: parsed.errors }

  const errors: string[] = []
  const blockIdentifiers = new Set<string>()
  const drafts = parsed.rows.map((row, index) => {
    const rowNumber = index + 2
    const blockIdentifier = getCsvValue(row, csvColumnAliases.blockIdentifier)
    if (blockIdentifier) blockIdentifiers.add(blockIdentifier)
    if (!blockIdentifier) errors.push(`Linha ${rowNumber}: informe a quadra.`)

    const identifier = getCsvValue(row, csvColumnAliases.identifier)
    if (!identifier) errors.push(`Linha ${rowNumber}: informe o lote.`)

    const numberFields = {
      front: getCsvValue(row, csvColumnAliases.front),
      back: getCsvValue(row, csvColumnAliases.back),
      leftSide: getCsvValue(row, csvColumnAliases.leftSide),
      rightSide: getCsvValue(row, csvColumnAliases.rightSide),
      totalArea: getCsvValue(row, csvColumnAliases.totalArea),
      price: getCsvValue(row, csvColumnAliases.price),
    }
    Object.entries(numberFields).forEach(([field, value]) => {
      if (!value) errors.push(`Linha ${rowNumber}: coluna ${field} obrigatoria.`)
    })

    const status = parseCsvStatus(getCsvValue(row, csvColumnAliases.status))
    if (!status) errors.push(`Linha ${rowNumber}: status invalido.`)

    return {
      blockIdentifier,
      identifier,
      front: parseCsvNumber(numberFields.front),
      back: parseCsvNumber(numberFields.back),
      leftSide: parseCsvNumber(numberFields.leftSide),
      rightSide: parseCsvNumber(numberFields.rightSide),
      totalArea: parseCsvNumber(numberFields.totalArea),
      price: parseCsvNumber(numberFields.price),
      status: status || defaultForm.status,
    }
  })

  drafts.forEach((draft, index) => {
    const rowNumber = index + 2
    if (!Number.isFinite(draft.front) || draft.front <= 0) errors.push(`Linha ${rowNumber}: frente deve ser maior que zero.`)
    if (!Number.isFinite(draft.back) || draft.back <= 0) errors.push(`Linha ${rowNumber}: fundo deve ser maior que zero.`)
    if (!Number.isFinite(draft.leftSide) || draft.leftSide <= 0) errors.push(`Linha ${rowNumber}: lateral esquerda deve ser maior que zero.`)
    if (!Number.isFinite(draft.rightSide) || draft.rightSide <= 0) errors.push(`Linha ${rowNumber}: lateral direita deve ser maior que zero.`)
    if (!Number.isFinite(draft.totalArea) || draft.totalArea <= 0) errors.push(`Linha ${rowNumber}: area deve ser maior que zero.`)
    if (!Number.isFinite(draft.price) || draft.price < 0) errors.push(`Linha ${rowNumber}: valor nao pode ser negativo.`)
  })

  if (drafts.length > 300) {
    errors.push('Importe no maximo 300 lotes por vez.')
  }
  const duplicateLots = drafts
    .map((draft) => draft.blockIdentifier && draft.identifier
      ? `${draft.blockIdentifier.toLowerCase()}::${draft.identifier.toLowerCase()}`
      : '')
    .filter((key, index, keys) => key && keys.indexOf(key) !== index)
  if (duplicateLots.length > 0) {
    errors.push('Existem lotes repetidos para a mesma quadra no CSV.')
  }

  return {
    drafts,
    blockIdentifier: [...blockIdentifiers][0] ?? '',
    blockCount: blockIdentifiers.size,
    errors,
  }
}

function createDrafts(form: typeof defaultForm): LotDraft[] {
  return Array.from({ length: Math.max(0, form.quantity) }, (_, index) => ({
    blockIdentifier: form.blockIdentifier,
    identifier: makeIdentifier(index),
    front: form.front,
    back: form.back,
    leftSide: form.leftSide,
    rightSide: form.rightSide,
    totalArea: form.totalArea,
    price: form.price,
    status: form.status,
  }))
}

export default function LotBatchDrawer({
  development,
  isOpen,
  onClose,
  onSave,
}: LotBatchDrawerProps) {
  const [form, setForm] = useState(defaultForm)
  const [drafts, setDrafts] = useState<LotDraft[]>(() => createDrafts(defaultForm))
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [importNotice, setImportNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setForm(defaultForm)
    setDrafts(createDrafts(defaultForm))
    setErrors([])
    setImportNotice(null)
  }, [isOpen, development?.id])

  const totalValue = useMemo(() => drafts.reduce((sum, draft) => sum + Number(draft.price || 0), 0), [drafts])
  const totalArea = useMemo(() => drafts.reduce((sum, draft) => sum + Number(draft.totalArea || 0), 0), [drafts])

  const updateForm = (field: keyof typeof defaultForm, value: string) => {
    const nextForm = {
      ...form,
      [field]: field === 'blockIdentifier' || field === 'status' ? value : Number(value),
    }
    setForm(nextForm)
    setDrafts(createDrafts(nextForm))
    setErrors([])
    setImportNotice(null)
  }

  const updateDraft = (index: number, field: keyof LotDraft, value: string) => {
    setDrafts((current) =>
      current.map((draft, draftIndex) => (
        draftIndex === index
          ? { ...draft, [field]: field === 'blockIdentifier' || field === 'identifier' || field === 'status' ? value : Number(value) }
          : draft
      )),
    )
    setErrors([])
    setImportNotice(null)
  }

  const downloadCsvTemplate = () => {
    const blob = new Blob([csvTemplate], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'modelo-lotes.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const importCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const result = parseLotCsv(await file.text())
      if (result.errors.length > 0) {
        setErrors(result.errors)
        setImportNotice(null)
        return
      }

      setDrafts(result.drafts)
      setForm((current) => ({
        ...current,
        blockIdentifier: result.blockIdentifier || current.blockIdentifier,
        quantity: result.drafts.length,
        front: result.drafts[0]?.front ?? current.front,
        back: result.drafts[0]?.back ?? current.back,
        leftSide: result.drafts[0]?.leftSide ?? current.leftSide,
        rightSide: result.drafts[0]?.rightSide ?? current.rightSide,
        totalArea: result.drafts[0]?.totalArea ?? current.totalArea,
        price: result.drafts[0]?.price ?? current.price,
        status: result.drafts[0]?.status ?? current.status,
      }))
      setErrors([])
      setImportNotice(`${result.drafts.length} lote(s) importado(s) em ${result.blockCount} quadra(s) para revisao.`)
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Nao foi possivel ler o arquivo CSV.'])
      setImportNotice(null)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!development || saving) return

    try {
      setSaving(true)
      setErrors([])
      const response = await fetch(`/api/developments/${development.id}/lots/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockIdentifier: form.blockIdentifier,
          lots: drafts,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setErrors(payload.errors || [payload.error || 'Nao foi possivel criar os lotes.'])
        return
      }

      onSave(payload.lots?.length ?? drafts.length)
      onClose()
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Nao foi possivel criar os lotes.'])
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDrawer
      isOpen={isOpen}
      title='Configurar lotes'
      description={development ? `Gerencie o estoque inicial e complementar de ${development.name}.` : 'Gerencie os lotes do empreendimento.'}
      onClose={onClose}
      widthClassName='max-w-5xl'
    >
      <form onSubmit={handleSubmit} className='space-y-6'>
        {errors.length > 0 && (
          <div className='rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>
            <p className='font-semibold'>Revise os campos antes de salvar</p>
            <ul className='mt-2 list-disc space-y-1 pl-5'>
              {errors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          </div>
        )}

        {importNotice && (
          <div className='rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700'>
            {importNotice}
          </div>
        )}

        <section className='rounded-2xl border border-border bg-surface-secondary p-5'>
          <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
            <div>
              <h3 className='text-base font-semibold text-foreground'>Resumo dos lotes</h3>
              <p className='mt-1 text-sm text-muted'>
                {development?.metrics?.totalLots
                  ? 'Use esta area para complementar novas quadras e lotes.'
                  : 'Nenhum lote cadastrado ainda. Crie a primeira quadra abaixo.'}
              </p>
            </div>
            {development?.id && (
              <a href={`/lots?developmentId=${development.id}`} className='rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-background'>
                Ver mapa/lista
              </a>
            )}
          </div>
          <div className='mt-5 grid grid-cols-2 gap-3 md:grid-cols-5'>
            {[
              ['Total', development?.metrics?.totalLots ?? 0],
              ['Disponiveis', development?.metrics?.availableLots ?? 0],
              ['Reservados', development?.metrics?.reservedLots ?? 0],
              ['Vendidos', development?.metrics?.soldLots ?? 0],
              ['VGV', formatCurrency(development?.metrics?.totalValue ?? 0)],
            ].map(([label, value]) => (
              <div key={label} className='rounded-xl border border-border bg-surface px-3 py-3'>
                <p className='text-xs font-semibold uppercase text-muted'>{label}</p>
                <p className='mt-1 text-base font-bold text-foreground'>{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className='rounded-2xl border border-border bg-surface-secondary p-5'>
          <div>
            <h3 className='text-base font-semibold text-foreground'>Nova quadra</h3>
            <p className='mt-1 text-sm text-muted'>Defina o modelo inicial. Depois ajuste os lotes diferentes na pre-visualizacao.</p>
          </div>

          <div className='mt-5 grid gap-4 md:grid-cols-2'>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Quadra</span>
              <input
                value={form.blockIdentifier}
                onChange={(event) => updateForm('blockIdentifier', event.target.value)}
                className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
                placeholder='A'
              />
            </label>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Quantidade de lotes</span>
              <input
                type='number'
                min={1}
                max={300}
                value={form.quantity}
                onChange={(event) => updateForm('quantity', event.target.value)}
                className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'
              />
            </label>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Frente (m)</span>
              <input type='number' min={0} step='0.01' value={form.front} onChange={(event) => updateForm('front', event.target.value)} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary' />
            </label>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Fundo (m)</span>
              <input type='number' min={0} step='0.01' value={form.back} onChange={(event) => updateForm('back', event.target.value)} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary' />
            </label>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Lateral esquerda (m)</span>
              <input type='number' min={0} step='0.01' value={form.leftSide} onChange={(event) => updateForm('leftSide', event.target.value)} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary' />
            </label>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Lateral direita (m)</span>
              <input type='number' min={0} step='0.01' value={form.rightSide} onChange={(event) => updateForm('rightSide', event.target.value)} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary' />
            </label>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Area padrao (m2)</span>
              <input type='number' min={0} step='0.01' value={form.totalArea} onChange={(event) => updateForm('totalArea', event.target.value)} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary' />
            </label>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Valor padrao</span>
              <input type='number' min={0} step='0.01' value={form.price} onChange={(event) => updateForm('price', event.target.value)} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary' />
            </label>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Status padrao</span>
              <select value={form.status} onChange={(event) => updateForm('status', event.target.value)} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary'>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className='rounded-2xl border border-border bg-surface-secondary p-5'>
          <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
            <div>
              <h3 className='text-base font-semibold text-foreground'>Importar CSV</h3>
              <p className='mt-1 text-sm text-muted'>Use uma planilha para preencher a pre-visualizacao e revise antes de criar os lotes.</p>
              <p className='mt-2 text-xs font-semibold text-muted'>
                Status aceitos: available, reserved, on_hold, sold. Tambem aceitamos disponivel, reservado, bloqueado e vendido.
              </p>
            </div>
            <div className='flex flex-col gap-2 sm:flex-row'>
              <button
                type='button'
                onClick={downloadCsvTemplate}
                className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-background'
              >
                Baixar modelo
              </button>
              <label className='cursor-pointer rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-primary-strong'>
                Importar CSV
                <input type='file' accept='.csv,text/csv' onChange={importCsv} className='sr-only' />
              </label>
            </div>
          </div>
        </section>

        <section className='rounded-2xl border border-border bg-surface-secondary p-5'>
          <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
            <div>
              <h3 className='text-base font-semibold text-foreground'>Pre-visualizacao editavel</h3>
              <p className='mt-1 text-sm text-muted'>Altere apenas os lotes fora do padrao antes de criar.</p>
            </div>
            <div className='grid grid-cols-2 gap-2 text-right text-sm'>
              <div className='rounded-xl border border-border bg-surface px-3 py-2'>
                <p className='text-xs font-semibold uppercase text-muted'>Area</p>
                <p className='font-bold text-foreground'>{totalArea.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m2</p>
              </div>
              <div className='rounded-xl border border-border bg-surface px-3 py-2'>
                <p className='text-xs font-semibold uppercase text-muted'>VGV</p>
                <p className='font-bold text-foreground'>{formatCurrency(totalValue)}</p>
              </div>
            </div>
          </div>

          <div className='mt-5 overflow-x-auto'>
            <table className='min-w-full divide-y divide-border text-sm'>
              <thead>
                <tr className='text-left text-xs font-semibold uppercase text-muted'>
                  <th className='px-2 py-2'>Quadra</th>
                  <th className='px-2 py-2'>Lote</th>
                  <th className='px-2 py-2'>Area</th>
                  <th className='px-2 py-2'>Frente</th>
                  <th className='px-2 py-2'>Fundo</th>
                  <th className='px-2 py-2'>Lateral esq.</th>
                  <th className='px-2 py-2'>Lateral dir.</th>
                  <th className='px-2 py-2'>Valor</th>
                  <th className='px-2 py-2'>Status</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border'>
                {drafts.map((draft, index) => (
                  <tr key={index}>
                    <td className='px-2 py-2'>
                      <input value={draft.blockIdentifier} onChange={(event) => updateDraft(index, 'blockIdentifier', event.target.value)} className='w-20 rounded-lg border border-border bg-surface px-2 py-2 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary' />
                    </td>
                    <td className='px-2 py-2'>
                      <input value={draft.identifier} onChange={(event) => updateDraft(index, 'identifier', event.target.value)} className='w-20 rounded-lg border border-border bg-surface px-2 py-2 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary' />
                    </td>
                    <td className='px-2 py-2'>
                      <input type='number' min={0} step='0.01' value={draft.totalArea} onChange={(event) => updateDraft(index, 'totalArea', event.target.value)} className='w-24 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary' />
                    </td>
                    <td className='px-2 py-2'>
                      <input type='number' min={0} step='0.01' value={draft.front} onChange={(event) => updateDraft(index, 'front', event.target.value)} className='w-20 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary' />
                    </td>
                    <td className='px-2 py-2'>
                      <input type='number' min={0} step='0.01' value={draft.back} onChange={(event) => updateDraft(index, 'back', event.target.value)} className='w-20 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary' />
                    </td>
                    <td className='px-2 py-2'>
                      <input type='number' min={0} step='0.01' value={draft.leftSide} onChange={(event) => updateDraft(index, 'leftSide', event.target.value)} className='w-24 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary' />
                    </td>
                    <td className='px-2 py-2'>
                      <input type='number' min={0} step='0.01' value={draft.rightSide} onChange={(event) => updateDraft(index, 'rightSide', event.target.value)} className='w-24 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary' />
                    </td>
                    <td className='px-2 py-2'>
                      <input type='number' min={0} step='0.01' value={draft.price} onChange={(event) => updateDraft(index, 'price', event.target.value)} className='w-28 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary' />
                    </td>
                    <td className='px-2 py-2'>
                      <select value={draft.status} onChange={(event) => updateDraft(index, 'status', event.target.value)} className='w-32 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary'>
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className='flex justify-end gap-3 border-t border-border pt-6'>
          <button type='button' onClick={onClose} disabled={saving} className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary disabled:opacity-50'>Cancelar</button>
          <button type='submit' disabled={saving || drafts.length === 0} className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-50'>
            {saving ? 'Salvando lotes...' : `Criar ${drafts.length} lote(s)`}
          </button>
        </div>
      </form>
    </FormDrawer>
  )
}
