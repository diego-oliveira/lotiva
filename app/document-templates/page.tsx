'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import FormDrawer from '@/app/components/FormDrawer'
import InlineAlert from '@/app/components/InlineAlert'
import { defaultContractTemplate, documentVariableGroups } from '@/lib/document-templates'

type Company = { id: string; name: string }
type CustomVariable = {
  id: string
  key: string
  label: string
  type: string
  required: boolean
  defaultValue?: string | null
}
type UsageData = {
  template: { id: string; name: string; version: number }
  fields: Array<{ variable: string; label: string; type: string; required: boolean; defaultValue?: string | null }>
  developments: Array<{ id: string; name: string; selected: boolean; values: Record<string, string> }>
}
type PreviewData = {
  company: { id: string; name: string; customValues: Record<string, string> }
  developments: Array<{ id: string; name: string; values: Record<string, string> }>
}
type TemplateVersion = {
  id: string
  version: number
  status: string
  content: string
  publishedAt?: string | null
  updatedAt: string
}
type DocumentTemplate = {
  id: string
  name: string
  type: string
  purpose: string
  description?: string | null
  status: string
  company: Company
  versions: TemplateVersion[]
  _count: { developments: number }
}

const purposeOptions = [
  { value: 'sale_contract', label: 'Contrato de venda', description: 'Usado automaticamente na geracao de contratos das vendas.' },
  { value: 'reservation_term', label: 'Termo de reserva', description: 'Preparado para documentos emitidos durante a reserva.' },
  { value: 'proposal', label: 'Proposta comercial', description: 'Preparado para formalizacao de propostas.' },
  { value: 'receipt', label: 'Recibo', description: 'Preparado para comprovantes de recebimento.' },
] as const

const sampleValues: Record<string, string> = {
  'contrato.numero': 'CT20260001',
  'contrato.data': '12 de junho de 2026',
  'empresa.nome': 'Empresa Exemplo',
  'empreendimento.nome': 'Residencial Exemplo',
  'empreendimento.descricao': 'Descricao juridica e registral do empreendimento.',
  'empreendimento.origem_imovel': 'Historico de aquisicao e regularidade do imovel.',
  'vendedor.nome': 'Vendedor Exemplo Ltda.',
  'vendedor.documento': '00.000.000/0001-00',
  'vendedor.endereco': 'Endereco do vendedor',
  'vendedor.representantes': 'Representado por seu administrador.',
  'vendedor.instrucoes_pagamento': 'Pagamento por boleto ou transferencia.',
  'vendedor.foro': 'Comarca de Exemplo',
  'vendedor.clausulas_adicionais': 'Clausulas especificas do empreendimento.',
  'cliente.nome': 'Cliente Exemplo',
  'cliente.email': 'cliente@exemplo.com',
  'cliente.cpf': '000.000.000-00',
  'cliente.rg': '00.000.000-0',
  'cliente.endereco': 'Endereco do cliente',
  'cliente.nascimento': '1 de janeiro de 1990',
  'cliente.profissao': 'Profissao',
  'cliente.naturalidade': 'Cidade/UF',
  'cliente.estado_civil': 'Estado civil',
  'lote.numero': '10',
  'lote.quadra': 'A',
  'lote.area': '250 m2',
  'lote.frente': '10 m',
  'lote.fundo': '25 m',
  'lote.lateral_esquerda': '25 m',
  'lote.lateral_direita': '25 m',
  'venda.valor_total': 'R$ 150.000,00',
  'venda.entrada': 'R$ 15.000,00',
  'venda.saldo': 'R$ 135.000,00',
  'venda.numero_parcelas': '120',
  'venda.valor_parcela': 'R$ 1.125,00',
  'venda.primeiro_vencimento': '10 de julho de 2026',
  'venda.reajuste': 'Com reajuste anual.',
  'proposta.observacoes': 'Sem observacoes.',
}

function statusMeta(status: string) {
  if (status === 'published') return { label: 'Publicado', className: 'bg-emerald-50 text-emerald-700' }
  if (status === 'archived') return { label: 'Arquivado', className: 'bg-slate-100 text-slate-600' }
  return { label: 'Rascunho', className: 'bg-amber-50 text-amber-700' }
}

function purposeLabel(purpose: string) {
  return purposeOptions.find((option) => option.value === purpose)?.label ?? purpose
}

export default function DocumentTemplatesPage() {
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [customVariables, setCustomVariables] = useState<CustomVariable[]>([])
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [previewDevelopmentId, setPreviewDevelopmentId] = useState('')
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageSaving, setUsageSaving] = useState(false)
  const [usageSelections, setUsageSelections] = useState<string[]>([])
  const [usageConfigurations, setUsageConfigurations] = useState<Record<string, Record<string, string>>>({})
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [purpose, setPurpose] = useState('sale_contract')
  const [content, setContent] = useState(defaultContractTemplate)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [newVariableLabel, setNewVariableLabel] = useState('')
  const [newVariableKey, setNewVariableKey] = useState('')
  const [newVariableType, setNewVariableType] = useState('text')
  const [newVariableDefault, setNewVariableDefault] = useState('')
  const [newVariableRequired, setNewVariableRequired] = useState(false)

  const draft = editingTemplate?.versions.find((version) => version.status === 'draft')
  const published = editingTemplate?.versions.find((version) => version.status === 'published')
  const previewValues = useMemo(() => {
    const development = previewData?.developments.find((item) => item.id === previewDevelopmentId)
    return {
      ...sampleValues,
      ...(previewData?.company.customValues ?? {}),
      ...(previewData ? { 'empresa.nome': previewData.company.name } : {}),
      ...(development?.values ?? {}),
    } as Record<string, string>
  }, [previewData, previewDevelopmentId])
  const preview = useMemo(
    () => content.replace(/{{\s*([^{}]+?)\s*}}/g, (_, variable: string) => {
      const normalized = variable.trim()
      if (normalized === 'quebra_pagina') return '\n\n--- QUEBRA DE PAGINA ---\n\n'
      return previewValues[normalized] || `{{${normalized}}}`
    }),
    [content, previewValues],
  )
  const filteredTemplates = useMemo(() => templates.filter((template) => {
    if (statusFilter && template.status !== statusFilter) return false
    if (!search.trim()) return true
    const term = search.toLowerCase()
    return template.name.toLowerCase().includes(term) ||
      template.company.name.toLowerCase().includes(term) ||
      purposeLabel(template.purpose).toLowerCase().includes(term)
  }), [templates, search, statusFilter])

  async function loadData() {
    try {
      setLoading(true)
      const [templatesResponse, companiesResponse] = await Promise.all([
        fetch('/api/document-templates', { cache: 'no-store' }),
        fetch('/api/companies', { cache: 'no-store' }),
      ])
      if (!templatesResponse.ok || !companiesResponse.ok) throw new Error('Nao foi possivel carregar os modelos.')
      const [templateData, companyData] = await Promise.all([templatesResponse.json(), companiesResponse.json()])
      setTemplates(templateData)
      setCompanies(companyData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar modelos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    if (!formOpen || !companyId) {
      setCustomVariables([])
      setPreviewData(null)
      setPreviewDevelopmentId('')
      return
    }
    void Promise.all([loadCustomVariables(companyId), loadPreviewData(companyId)])
  }, [formOpen, companyId])

  async function loadCustomVariables(targetCompanyId: string) {
    const response = await fetch(`/api/document-variables?companyId=${targetCompanyId}`, { cache: 'no-store' })
    if (response.ok) setCustomVariables(await response.json())
  }

  async function loadPreviewData(targetCompanyId: string) {
    const response = await fetch(`/api/document-preview-data?companyId=${targetCompanyId}`, { cache: 'no-store' })
    if (!response.ok) return
    const payload: PreviewData = await response.json()
    setPreviewData(payload)
    setPreviewDevelopmentId((current) =>
      payload.developments.some((development) => development.id === current)
        ? current
        : payload.developments[0]?.id ?? '',
    )
  }

  function openNew() {
    setEditingTemplate(null)
    setName('')
    setDescription('')
    setCompanyId(companies[0]?.id ?? '')
    setPurpose('sale_contract')
    setContent(defaultContractTemplate)
    setFormOpen(true)
    setError(null)
  }

  function openEdit(template: DocumentTemplate) {
    const currentDraft = template.versions.find((version) => version.status === 'draft')
    const currentPublished = template.versions.find((version) => version.status === 'published')
    setEditingTemplate(template)
    setName(template.name)
    setDescription(template.description ?? '')
    setCompanyId(template.company.id)
    setPurpose(template.purpose)
    setContent(currentDraft?.content ?? currentPublished?.content ?? defaultContractTemplate)
    setFormOpen(true)
    setError(null)
  }

  function closeForm() {
    if (saving) return
    setFormOpen(false)
    setEditingTemplate(null)
  }

  function insertVariable(variable: string) {
    const token = `{{${variable}}}`
    const editor = editorRef.current
    if (!editor) return setContent((current) => `${current}${token}`)
    const start = editor.selectionStart
    const end = editor.selectionEnd
    setContent((current) => `${current.slice(0, start)}${token}${current.slice(end)}`)
    requestAnimationFrame(() => {
      editor.focus()
      editor.setSelectionRange(start + token.length, start + token.length)
    })
  }

  async function createCustomVariable() {
    if (!companyId || !newVariableLabel.trim()) return
    try {
      setSaving(true)
      setError(null)
      const response = await fetch('/api/document-variables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          label: newVariableLabel,
          key: newVariableKey,
          type: newVariableType,
          defaultValue: newVariableDefault,
          required: newVariableRequired,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Nao foi possivel criar a variavel.')
      await loadCustomVariables(companyId)
      await loadPreviewData(companyId)
      insertVariable(`custom.${payload.key}`)
      setNewVariableLabel('')
      setNewVariableKey('')
      setNewVariableType('text')
      setNewVariableDefault('')
      setNewVariableRequired(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar variavel.')
    } finally {
      setSaving(false)
    }
  }

  async function openUsage(templateId: string) {
    try {
      setUsageLoading(true)
      setError(null)
      const response = await fetch(`/api/document-templates/${templateId}/usage`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Nao foi possivel analisar o uso do modelo.')
      setUsageData(payload)
      setUsageSelections(payload.developments.filter((development: UsageData['developments'][number]) => development.selected).map((development: UsageData['developments'][number]) => development.id))
      setUsageConfigurations(Object.fromEntries(
        payload.developments.map((development: UsageData['developments'][number]) => [development.id, development.values]),
      ))
      setUsageOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao configurar uso.')
    } finally {
      setUsageLoading(false)
    }
  }

  function toggleUsageDevelopment(developmentId: string) {
    setUsageSelections((current) =>
      current.includes(developmentId)
        ? current.filter((id) => id !== developmentId)
        : [...current, developmentId],
    )
  }

  function updateUsageValue(developmentId: string, variable: string, value: string) {
    setUsageConfigurations((current) => ({
      ...current,
      [developmentId]: {
        ...current[developmentId],
        [variable]: value,
      },
    }))
  }

  async function saveUsage() {
    if (!usageData) return
    try {
      setUsageSaving(true)
      setError(null)
      const response = await fetch(`/api/document-templates/${usageData.template.id}/usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          developmentIds: usageSelections,
          configurations: usageConfigurations,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        const missing = payload.missingFields?.join(', ')
        throw new Error(missing ? `${payload.error} ${missing}` : payload.error || 'Nao foi possivel ativar o modelo.')
      }
      await loadData()
      setUsageOpen(false)
      setUsageData(null)
      setSuccess(`Modelo configurado em ${payload.developmentCount} empreendimento(s).`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao ativar modelo.')
    } finally {
      setUsageSaving(false)
    }
  }

  async function save() {
    try {
      setSaving(true)
      setError(null)
      const response = await fetch(editingTemplate ? `/api/document-templates/${editingTemplate.id}` : '/api/document-templates', {
        method: editingTemplate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, companyId, type: 'contract', purpose, content }),
      })
      const payload = await response.json()
      if (!response.ok) {
        const unknown = payload.unknownVariables?.join(', ')
        throw new Error(unknown ? `${payload.error} ${unknown}` : payload.error || 'Nao foi possivel salvar o modelo.')
      }
      await loadData()
      setFormOpen(false)
      setEditingTemplate(null)
      setSuccess(editingTemplate ? 'Rascunho atualizado.' : 'Modelo criado como rascunho.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar modelo.')
    } finally {
      setSaving(false)
    }
  }

  async function publish() {
    if (!editingTemplate) return
    try {
      setSaving(true)
      setError(null)
      const response = await fetch(`/api/document-templates/${editingTemplate.id}/publish`, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Nao foi possivel publicar.')
      await loadData()
      setFormOpen(false)
      const templateId = editingTemplate.id
      setEditingTemplate(null)
      setSuccess(`Versao ${payload.version.version} publicada.`)
      await openUsage(templateId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao publicar modelo.')
    } finally {
      setSaving(false)
    }
  }

  async function archive() {
    if (!editingTemplate || !window.confirm('Arquivar este modelo e remove-lo dos empreendimentos vinculados?')) return
    try {
      setSaving(true)
      const response = await fetch(`/api/document-templates/${editingTemplate.id}`, { method: 'DELETE' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Nao foi possivel arquivar.')
      await loadData()
      setFormOpen(false)
      setEditingTemplate(null)
      setSuccess('Modelo arquivado. Contratos emitidos continuam preservados.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao arquivar modelo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='space-y-6'>
      {success && <InlineAlert variant='success' title='Modelo atualizado' message={success} onClose={() => setSuccess(null)} />}
      {error && <InlineAlert variant='error' title='Nao foi possivel concluir' message={error} onClose={() => setError(null)} />}

      <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='page-title'>Modelos de documentos</h1>
          <p className='page-subtitle'>Gerencie modelos, finalidades de uso e versoes publicadas.</p>
        </div>
        <button onClick={openNew} disabled={companies.length === 0} className='rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-50'>
          Novo modelo
        </button>
      </div>

      <section className='panel overflow-hidden'>
        <div className='panel-header flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <h2 className='text-lg font-semibold text-foreground'>{filteredTemplates.length} modelo(s)</h2>
            <p className='mt-1 text-sm text-muted'>O empreendimento define qual contrato de venda publicado sera utilizado.</p>
          </div>
          <div className='flex flex-col gap-3 sm:flex-row'>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder='Buscar modelo ou empresa...' className='rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary' />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className='rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary'>
              <option value=''>Todos os status</option>
              <option value='draft'>Rascunhos</option>
              <option value='published'>Publicados</option>
              <option value='archived'>Arquivados</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className='grid gap-5 p-6 md:grid-cols-2 xl:grid-cols-3'>
            {[1, 2, 3].map((item) => <div key={item} className='h-64 animate-pulse rounded-2xl bg-surface-secondary' />)}
          </div>
        ) : (
          <div className='grid gap-5 p-6 md:grid-cols-2 xl:grid-cols-3'>
            {filteredTemplates.map((template) => {
              const meta = statusMeta(template.status)
              const currentPublished = template.versions.find((version) => version.status === 'published')
              const currentDraft = template.versions.find((version) => version.status === 'draft')
              const usageStatus = template.status !== 'published'
                ? 'Publique para configurar'
                : template._count.developments > 0
                  ? 'Pronto para vendas'
                  : 'Publicado, nao vinculado'
              return (
                <article key={template.id} className='flex min-h-64 flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md'>
                  <div className='flex items-start justify-between gap-4'>
                    <div className='flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary'>
                      <svg className='h-6 w-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M7 3.75h7l3 3V20.25H7zM14 3.75v3h3M9.5 11h5M9.5 14.5h5M9.5 18h3' />
                      </svg>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span>
                  </div>
                  <h3 className='mt-5 text-lg font-semibold text-foreground'>{template.name}</h3>
                  <p className='mt-1 text-sm text-muted'>{template.company.name}</p>
                  <p className='mt-3 line-clamp-2 text-sm leading-6 text-muted'>{template.description || 'Sem descricao.'}</p>
                  <div className='mt-4 flex flex-wrap gap-2'>
                    <span className='rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary'>{purposeLabel(template.purpose)}</span>
                    <span className='rounded-full bg-surface-secondary px-3 py-1 text-xs font-semibold text-muted'>
                      {currentPublished ? `Publicada v${currentPublished.version}` : 'Sem versao publicada'}
                    </span>
                    {currentDraft && <span className='rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700'>Rascunho v{currentDraft.version}</span>}
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${template._count.developments > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-secondary text-muted'}`}>{usageStatus}</span>
                  </div>
                  <div className='mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5'>
                    <span className='text-xs text-muted'>{template._count.developments} empreendimento(s)</span>
                    <div className='flex gap-2'>
                      {template.status === 'published' && template.purpose === 'sale_contract' && (
                        <button onClick={() => openUsage(template.id)} disabled={usageLoading} className='rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-50'>
                          Configurar uso
                        </button>
                      )}
                      <button onClick={() => openEdit(template)} className='rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-surface-secondary'>
                        Editar
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
            {filteredTemplates.length === 0 && (
              <div className='col-span-full rounded-2xl border border-dashed border-border px-6 py-14 text-center'>
                <p className='font-semibold text-foreground'>Nenhum modelo encontrado</p>
                <p className='mt-2 text-sm text-muted'>Ajuste os filtros ou crie um novo modelo.</p>
              </div>
            )}
          </div>
        )}
      </section>

      <FormDrawer
        isOpen={formOpen}
        title={editingTemplate ? 'Editar modelo' : 'Novo modelo'}
        description='Defina a finalidade, edite o conteudo e publique uma versao para uso operacional.'
        onClose={closeForm}
        widthClassName='max-w-6xl'
      >
        <div className='space-y-6'>
          <div className='grid gap-4 md:grid-cols-2'>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Nome do modelo</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder='Contrato padrao de compra e venda' className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary' />
            </label>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Empresa</span>
              <select value={companyId} onChange={(event) => setCompanyId(event.target.value)} disabled={Boolean(editingTemplate)} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary disabled:opacity-60'>
                <option value=''>Selecione</option>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </label>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Finalidade</span>
              <select value={purpose} onChange={(event) => setPurpose(event.target.value)} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary'>
                {purposeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <p className='mt-2 text-xs text-muted'>{purposeOptions.find((option) => option.value === purpose)?.description}</p>
            </label>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold text-foreground'>Descricao</span>
              <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder='Quando este modelo deve ser utilizado' className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary' />
            </label>
          </div>

          <div className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]'>
            <div className='overflow-hidden rounded-2xl border border-border'>
              <div className='flex items-center justify-between bg-surface-secondary px-5 py-4'>
                <div>
                  <h3 className='font-semibold text-foreground'>Conteudo do documento</h3>
                  <p className='mt-1 text-xs text-muted'>Use as variaveis ao lado para preencher dados automaticamente.</p>
                </div>
                {editingTemplate && <span className='text-xs text-muted'>{published ? `Publicada v${published.version}` : 'Sem publicacao'} · {draft ? `Rascunho v${draft.version}` : 'Sem rascunho'}</span>}
              </div>
              <textarea ref={editorRef} value={content} onChange={(event) => setContent(event.target.value)} className='min-h-[620px] w-full resize-y border-0 bg-white p-6 font-mono text-sm leading-7 text-foreground outline-none' />
            </div>

            <aside className='space-y-5'>
              <div className='rounded-2xl border border-border p-5'>
                <h3 className='font-semibold text-foreground'>Variaveis</h3>
                <p className='mt-1 text-xs text-muted'>Clique para inserir no cursor.</p>
                <div className='mt-4 max-h-[520px] space-y-4 overflow-y-auto pr-1'>
                  {documentVariableGroups.map((group) => (
                    <div key={group.label}>
                      <p className='text-xs font-bold uppercase tracking-wide text-muted'>{group.label}</p>
                      <div className='mt-2 flex flex-wrap gap-2'>
                        {group.variables.map(([variable, label]) => (
                          <button key={variable} type='button' title={label} onClick={() => insertVariable(variable)} className='rounded-lg border border-border bg-surface-secondary px-2 py-1.5 font-mono text-[11px] text-primary hover:border-primary'>
                            {`{{${variable}}}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button type='button' onClick={() => insertVariable('quebra_pagina')} className='rounded-lg border border-border bg-surface-secondary px-2 py-1.5 font-mono text-[11px] text-primary'>
                    {'{{quebra_pagina}}'}
                  </button>
                  {customVariables.length > 0 && (
                    <div>
                      <p className='text-xs font-bold uppercase tracking-wide text-muted'>Personalizadas</p>
                      <div className='mt-2 flex flex-wrap gap-2'>
                        {customVariables.map((variable) => (
                          <button key={variable.id} type='button' title={variable.label} onClick={() => insertVariable(`custom.${variable.key}`)} className='rounded-lg border border-primary/30 bg-primary/5 px-2 py-1.5 font-mono text-[11px] text-primary'>
                            {`{{custom.${variable.key}}}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className='rounded-2xl border border-border p-5'>
                <h3 className='font-semibold text-foreground'>Nova variavel</h3>
                <p className='mt-1 text-xs text-muted'>Crie um campo reutilizavel pela empresa e seus empreendimentos.</p>
                <div className='mt-4 space-y-3'>
                  <input value={newVariableLabel} onChange={(event) => setNewVariableLabel(event.target.value)} placeholder='Nome amigavel' className='w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary' />
                  <input value={newVariableKey} onChange={(event) => setNewVariableKey(event.target.value)} placeholder='identificador_opcional' className='w-full rounded-xl border border-border px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-primary' />
                  <select value={newVariableType} onChange={(event) => setNewVariableType(event.target.value)} className='w-full rounded-xl border border-border px-3 py-2 text-sm'>
                    <option value='text'>Texto curto</option>
                    <option value='textarea'>Texto longo</option>
                    <option value='date'>Data</option>
                    <option value='number'>Numero</option>
                    <option value='currency'>Moeda</option>
                  </select>
                  <input value={newVariableDefault} onChange={(event) => setNewVariableDefault(event.target.value)} placeholder='Valor padrao da empresa' className='w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary' />
                  <label className='flex items-center gap-2 text-sm text-foreground'>
                    <input type='checkbox' checked={newVariableRequired} onChange={(event) => setNewVariableRequired(event.target.checked)} />
                    Obrigatoria para gerar documento
                  </label>
                  <button type='button' onClick={createCustomVariable} disabled={saving || !newVariableLabel.trim()} className='w-full rounded-xl border border-primary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50'>
                    Criar e inserir
                  </button>
                </div>
              </div>

              {editingTemplate && (
                <div className='rounded-2xl border border-border p-5'>
                  <h3 className='font-semibold text-foreground'>Versoes</h3>
                  <div className='mt-3 space-y-2'>
                    {editingTemplate.versions.map((version) => (
                      <div key={version.id} className='flex items-center justify-between rounded-xl bg-surface-secondary px-3 py-3'>
                        <span className='text-sm font-semibold text-foreground'>v{version.version}</span>
                        <span className='text-xs text-muted'>{statusMeta(version.status).label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>

          <div className='overflow-hidden rounded-2xl border border-border'>
            <div className='flex flex-col gap-3 bg-surface-secondary px-5 py-4 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <h3 className='font-semibold text-foreground'>Pre-visualizacao</h3>
                <p className='mt-1 text-xs text-muted'>
                  Valores configurados sao utilizados quando disponiveis; dados de cliente, lote e venda permanecem simulados.
                </p>
              </div>
              {previewData && previewData.developments.length > 0 && (
                <select value={previewDevelopmentId} onChange={(event) => setPreviewDevelopmentId(event.target.value)} className='rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground'>
                  {previewData.developments.map((development) => (
                    <option key={development.id} value={development.id}>{development.name}</option>
                  ))}
                </select>
              )}
            </div>
            <pre className='max-h-[520px] overflow-auto whitespace-pre-wrap bg-white p-6 font-serif text-sm leading-7 text-foreground'>{preview}</pre>
          </div>

          <div className='flex flex-wrap justify-end gap-3 border-t border-border pt-5'>
            {editingTemplate && editingTemplate.status !== 'archived' && (
              <button onClick={archive} disabled={saving} className='mr-auto rounded-xl px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50'>Arquivar</button>
            )}
            <button onClick={closeForm} disabled={saving} className='rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground hover:bg-surface-secondary'>Cancelar</button>
            <button onClick={save} disabled={saving || !name.trim() || !companyId || !content.trim()} className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground hover:bg-surface-secondary disabled:opacity-50'>
              {saving ? 'Salvando...' : 'Salvar rascunho'}
            </button>
            {editingTemplate && draft && (
              <button onClick={publish} disabled={saving} className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary-strong disabled:opacity-50'>Publicar versao</button>
            )}
          </div>
        </div>
      </FormDrawer>

      <FormDrawer
        isOpen={usageOpen}
        title='Configurar uso do modelo'
        description='Selecione os empreendimentos e preencha somente os dados utilizados pela versao publicada.'
        onClose={() => !usageSaving && setUsageOpen(false)}
        widthClassName='max-w-4xl'
      >
        {usageData && (
          <div className='space-y-6'>
            <div className='rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4'>
              <p className='font-semibold text-foreground'>{usageData.template.name}</p>
              <p className='mt-1 text-sm text-muted'>Versao publicada {usageData.template.version}</p>
            </div>

            {usageData.developments.map((development) => {
              const selected = usageSelections.includes(development.id)
              return (
                <div key={development.id} className={`rounded-2xl border p-5 ${selected ? 'border-primary bg-primary/3' : 'border-border'}`}>
                  <label className='flex cursor-pointer items-center gap-3'>
                    <input type='checkbox' checked={selected} onChange={() => toggleUsageDevelopment(development.id)} />
                    <span className='font-semibold text-foreground'>{development.name}</span>
                  </label>
                  {selected && (
                    <div className='mt-5 grid gap-4 md:grid-cols-2'>
                      {usageData.fields.map((field) => (
                        <label key={field.variable} className={`block ${field.type === 'textarea' ? 'md:col-span-2' : ''}`}>
                          <span className='mb-2 block text-sm font-semibold text-foreground'>
                            {field.label}{field.required ? ' *' : ''}
                          </span>
                          {field.type === 'textarea' ? (
                            <textarea rows={4} value={usageConfigurations[development.id]?.[field.variable] ?? ''} onChange={(event) => updateUsageValue(development.id, field.variable, event.target.value)} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary' />
                          ) : (
                            <input type={field.type === 'date' ? 'date' : field.type === 'number' || field.type === 'currency' ? 'number' : 'text'} value={usageConfigurations[development.id]?.[field.variable] ?? ''} onChange={(event) => updateUsageValue(development.id, field.variable, event.target.value)} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary' />
                          )}
                          {field.variable.startsWith('custom.') && field.defaultValue && (
                            <p className='mt-1 text-xs text-muted'>Padrao da empresa: {field.defaultValue}</p>
                          )}
                        </label>
                      ))}
                      {usageData.fields.length === 0 && (
                        <p className='md:col-span-2 text-sm text-muted'>Este modelo utiliza apenas dados automaticos. Nenhuma configuracao adicional e necessaria.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {usageData.developments.length === 0 && (
              <p className='rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted'>Nenhum empreendimento acessivel pertence a esta empresa.</p>
            )}

            <div className='flex justify-end gap-3 border-t border-border pt-5'>
              <button onClick={() => setUsageOpen(false)} disabled={usageSaving} className='rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground'>Cancelar</button>
              <button onClick={saveUsage} disabled={usageSaving} className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50'>
                {usageSaving ? 'Salvando...' : 'Salvar e ativar'}
              </button>
            </div>
          </div>
        )}
      </FormDrawer>
    </div>
  )
}
