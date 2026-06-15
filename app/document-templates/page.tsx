'use client'

import { useEffect, useMemo, useState } from 'react'
import FormDrawer from '@/app/components/FormDrawer'
import InlineAlert from '@/app/components/InlineAlert'
import { documentVariableGroups } from '@/lib/document-templates'

type Company = { id: string; name: string }
type CustomVariable = {
  id: string
  key: string
  label: string
  type: string
  required: boolean
  defaultValue?: string | null
}
type TemplateVersion = {
  id: string
  version: number
  status: string
  fileName: string
  fileHash: string
  variables: string[]
  publishedAt?: string | null
  updatedAt: string
}
type DocumentTemplate = {
  id: string
  name: string
  purpose: string
  description?: string | null
  status: string
  company: Company
  versions: TemplateVersion[]
  _count: { developments: number }
}
type UsageData = {
  template: { id: string; name: string; version: number }
  fields: Array<{ variable: string; label: string; type: string; required: boolean; defaultValue?: string | null }>
  developments: Array<{ id: string; name: string; selected: boolean; values: Record<string, string> }>
}

const purposeOptions = [
  { value: 'sale_contract', label: 'Contrato de venda' },
  { value: 'reservation_term', label: 'Termo de reserva' },
  { value: 'proposal', label: 'Proposta comercial' },
  { value: 'receipt', label: 'Recibo' },
]

function statusMeta(status: string) {
  if (status === 'published') return { label: 'Publicado', className: 'bg-emerald-50 text-emerald-700' }
  if (status === 'archived') return { label: 'Arquivado', className: 'bg-slate-100 text-slate-600' }
  return { label: 'Rascunho', className: 'bg-amber-50 text-amber-700' }
}

export default function DocumentTemplatesPage() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [customVariables, setCustomVariables] = useState<CustomVariable[]>([])
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [usageSelections, setUsageSelections] = useState<string[]>([])
  const [usageConfigurations, setUsageConfigurations] = useState<Record<string, Record<string, string>>>({})
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [purpose, setPurpose] = useState('sale_contract')
  const [file, setFile] = useState<File | null>(null)
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

  const filteredTemplates = useMemo(() => templates.filter((template) => {
    if (statusFilter && template.status !== statusFilter) return false
    if (!search.trim()) return true
    const term = search.toLowerCase()
    return template.name.toLowerCase().includes(term) || template.company.name.toLowerCase().includes(term)
  }), [templates, search, statusFilter])

  async function loadData() {
    try {
      setLoading(true)
      const [templatesResponse, companiesResponse] = await Promise.all([
        fetch('/api/document-templates', { cache: 'no-store' }),
        fetch('/api/companies', { cache: 'no-store' }),
      ])
      if (!templatesResponse.ok || !companiesResponse.ok) throw new Error('Nao foi possivel carregar os modelos.')
      setTemplates(await templatesResponse.json())
      setCompanies(await companiesResponse.json())
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar modelos.')
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
      return
    }
    fetch(`/api/document-variables?companyId=${companyId}`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : [])
      .then(setCustomVariables)
      .catch(() => setCustomVariables([]))
  }, [companyId, formOpen])

  function openNew() {
    setEditingTemplate(null)
    setName('')
    setDescription('')
    setCompanyId(companies[0]?.id ?? '')
    setPurpose('sale_contract')
    setFile(null)
    setFormOpen(true)
  }

  function openEdit(template: DocumentTemplate) {
    setEditingTemplate(template)
    setName(template.name)
    setDescription(template.description ?? '')
    setCompanyId(template.company.id)
    setPurpose(template.purpose)
    setFile(null)
    setFormOpen(true)
  }

  async function save() {
    if (!name.trim() || !companyId || (!editingTemplate && !file)) return
    try {
      setSaving(true)
      setError(null)
      const data = new FormData()
      data.append('name', name)
      data.append('description', description)
      data.append('companyId', companyId)
      data.append('purpose', purpose)
      if (file) data.append('file', file)

      const response = await fetch(
        editingTemplate ? `/api/document-templates/${editingTemplate.id}` : '/api/document-templates',
        { method: editingTemplate ? 'PUT' : 'POST', body: data },
      )
      const payload = await response.json()
      if (!response.ok) {
        const unknown = payload.unknownVariables?.map((variable: string) => `{{${variable}}}`).join(', ')
        throw new Error(unknown ? `${payload.error} ${unknown}` : payload.error || 'Nao foi possivel salvar o modelo.')
      }
      await loadData()
      setFormOpen(false)
      setSuccess(editingTemplate
        ? file ? 'Nova versao DOCX criada como rascunho.' : 'Dados do modelo atualizados.'
        : 'Modelo DOCX criado como rascunho.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Erro ao salvar modelo.')
    } finally {
      setSaving(false)
    }
  }

  async function publish(template: DocumentTemplate) {
    try {
      setSaving(true)
      const response = await fetch(`/api/document-templates/${template.id}/publish`, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Nao foi possivel publicar.')
      await loadData()
      setFormOpen(false)
      setSuccess(`Versao ${payload.version.version} publicada.`)
      await openUsage(template.id)
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Erro ao publicar.')
    } finally {
      setSaving(false)
    }
  }

  async function archive(template: DocumentTemplate) {
    if (!window.confirm('Arquivar este modelo e remove-lo dos empreendimentos vinculados?')) return
    const response = await fetch(`/api/document-templates/${template.id}`, { method: 'DELETE' })
    const payload = await response.json()
    if (!response.ok) return setError(payload.error || 'Nao foi possivel arquivar.')
    await loadData()
    setFormOpen(false)
    setSuccess('Modelo arquivado. Contratos emitidos continuam preservados.')
  }

  async function createCustomVariable() {
    if (!companyId || !newVariableLabel.trim()) return
    try {
      setSaving(true)
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
      setCustomVariables((current) => [...current, payload])
      setNewVariableLabel('')
      setNewVariableKey('')
      setNewVariableDefault('')
      setNewVariableRequired(false)
    } catch (variableError) {
      setError(variableError instanceof Error ? variableError.message : 'Erro ao criar variavel.')
    } finally {
      setSaving(false)
    }
  }

  async function openUsage(templateId: string) {
    try {
      const response = await fetch(`/api/document-templates/${templateId}/usage`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Nao foi possivel configurar o uso.')
      setUsageData(payload)
      setUsageSelections(payload.developments.filter((item: UsageData['developments'][number]) => item.selected).map((item: UsageData['developments'][number]) => item.id))
      setUsageConfigurations(Object.fromEntries(payload.developments.map((item: UsageData['developments'][number]) => [item.id, item.values])))
      setUsageOpen(true)
    } catch (usageError) {
      setError(usageError instanceof Error ? usageError.message : 'Erro ao configurar uso.')
    }
  }

  async function saveUsage() {
    if (!usageData) return
    try {
      setSaving(true)
      const response = await fetch(`/api/document-templates/${usageData.template.id}/usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ developmentIds: usageSelections, configurations: usageConfigurations }),
      })
      const payload = await response.json()
      if (!response.ok) {
        const missing = payload.missingFields?.join(', ')
        throw new Error(missing ? `${payload.error} ${missing}` : payload.error || 'Nao foi possivel ativar.')
      }
      await loadData()
      setUsageOpen(false)
      setSuccess(`Modelo configurado em ${payload.developmentCount} empreendimento(s).`)
    } catch (usageError) {
      setError(usageError instanceof Error ? usageError.message : 'Erro ao configurar uso.')
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
          <p className='page-subtitle'>Envie arquivos DOCX com variaveis e publique versoes imutaveis.</p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <button onClick={() => setGuideOpen(true)} className='rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground'>
            Variaveis e instrucoes
          </button>
          <a href='/api/document-templates/sample' className='rounded-2xl border border-primary px-4 py-3 text-sm font-semibold text-primary'>
            Baixar DOCX modelo
          </a>
          <button onClick={openNew} disabled={companies.length === 0} className='rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50'>
            Novo modelo
          </button>
        </div>
      </div>

      <section className='panel overflow-hidden'>
        <div className='panel-header flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <h2 className='text-lg font-semibold text-foreground'>{filteredTemplates.length} modelo(s)</h2>
            <p className='mt-1 text-sm text-muted'>Cada upload cria uma nova versao do documento.</p>
          </div>
          <div className='flex gap-3'>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder='Buscar modelo...' className='rounded-xl border border-border bg-background px-4 py-3 text-sm' />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className='rounded-xl border border-border bg-background px-4 py-3 text-sm'>
              <option value=''>Todos</option>
              <option value='draft'>Rascunhos</option>
              <option value='published'>Publicados</option>
              <option value='archived'>Arquivados</option>
            </select>
          </div>
        </div>
        {loading ? (
          <div className='p-10 text-center text-sm text-muted'>Carregando modelos...</div>
        ) : (
          <div className='grid gap-5 p-6 md:grid-cols-2 xl:grid-cols-3'>
            {filteredTemplates.map((template) => {
              const meta = statusMeta(template.status)
              const published = template.versions.find((version) => version.status === 'published')
              const draft = template.versions.find((version) => version.status === 'draft')
              return (
                <article key={template.id} className='flex min-h-72 flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm'>
                  <div className='flex items-start justify-between'>
                    <div className='flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary'>W</div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span>
                  </div>
                  <h3 className='mt-5 text-lg font-semibold'>{template.name}</h3>
                  <p className='mt-1 text-sm text-muted'>{template.company.name}</p>
                  <p className='mt-3 line-clamp-2 text-sm leading-6 text-muted'>{template.description || 'Sem descricao.'}</p>
                  <div className='mt-4 flex flex-wrap gap-2 text-xs font-semibold'>
                    {published && <span className='rounded-full bg-emerald-50 px-3 py-1 text-emerald-700'>Publicada v{published.version}</span>}
                    {draft && <span className='rounded-full bg-amber-50 px-3 py-1 text-amber-700'>Rascunho v{draft.version}</span>}
                    <span className='rounded-full bg-surface-secondary px-3 py-1 text-muted'>{template._count.developments} empreendimento(s)</span>
                  </div>
                  <div className='mt-auto flex flex-wrap justify-end gap-2 border-t border-border pt-5'>
                    {template.status === 'published' && <button onClick={() => openUsage(template.id)} className='rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white'>Configurar uso</button>}
                    <button onClick={() => openEdit(template)} className='rounded-xl border border-border px-3 py-2 text-sm font-semibold'>Detalhes</button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <FormDrawer
        isOpen={formOpen}
        title={editingTemplate ? 'Modelo e versoes' : 'Novo modelo DOCX'}
        description='O arquivo deve usar variaveis no formato {{cliente.nome}}.'
        onClose={() => !saving && setFormOpen(false)}
        widthClassName='max-w-4xl'
      >
        <div className='space-y-6'>
          <div className='grid gap-4 md:grid-cols-2'>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold'>Nome do modelo</span>
              <input value={name} onChange={(event) => setName(event.target.value)} className='w-full rounded-xl border border-border px-4 py-3 text-sm' />
            </label>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold'>Empresa</span>
              <select value={companyId} onChange={(event) => setCompanyId(event.target.value)} disabled={Boolean(editingTemplate)} className='w-full rounded-xl border border-border px-4 py-3 text-sm disabled:opacity-60'>
                <option value=''>Selecione</option>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </label>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold'>Finalidade</span>
              <select value={purpose} onChange={(event) => setPurpose(event.target.value)} className='w-full rounded-xl border border-border px-4 py-3 text-sm'>
                {purposeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className='block'>
              <span className='mb-2 block text-sm font-semibold'>Descricao</span>
              <input value={description} onChange={(event) => setDescription(event.target.value)} className='w-full rounded-xl border border-border px-4 py-3 text-sm' />
            </label>
          </div>

          <div className='rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6'>
            <p className='font-semibold text-foreground'>{editingTemplate ? 'Enviar nova versao' : 'Arquivo DOCX'}</p>
            <p className='mt-1 text-sm text-muted'>Formatacao, fontes, margens, tabelas, cabecalhos e rodapes serao preservados.</p>
            <input
              type='file'
              accept='.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className='mt-4 block w-full text-sm'
            />
            {file && <p className='mt-3 text-sm font-semibold text-primary'>{file.name}</p>}
          </div>

          {editingTemplate && (
            <div className='rounded-2xl border border-border p-5'>
              <h3 className='font-semibold'>Historico de versoes</h3>
              <div className='mt-4 space-y-3'>
                {editingTemplate.versions.map((version) => (
                  <div key={version.id} className='flex flex-col gap-3 rounded-xl bg-surface-secondary px-4 py-3 sm:flex-row sm:items-center sm:justify-between'>
                    <div>
                      <p className='text-sm font-semibold'>Versao {version.version} · {statusMeta(version.status).label}</p>
                      <p className='mt-1 text-xs text-muted'>{version.fileName} · {version.variables.length} variavel(is)</p>
                    </div>
                    <a href={`/api/document-templates/${editingTemplate.id}/versions/${version.id}/file`} className='text-sm font-semibold text-primary'>Baixar DOCX</a>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className='rounded-2xl border border-border p-5'>
            <h3 className='font-semibold'>Variaveis personalizadas</h3>
            <p className='mt-1 text-sm text-muted'>Crie antes do upload quando o documento precisar de dados especificos da empresa.</p>
            <div className='mt-4 grid gap-3 md:grid-cols-2'>
              <input value={newVariableLabel} onChange={(event) => setNewVariableLabel(event.target.value)} placeholder='Nome amigavel' className='rounded-xl border border-border px-3 py-2 text-sm' />
              <input value={newVariableKey} onChange={(event) => setNewVariableKey(event.target.value)} placeholder='identificador_opcional' className='rounded-xl border border-border px-3 py-2 font-mono text-sm' />
              <select value={newVariableType} onChange={(event) => setNewVariableType(event.target.value)} className='rounded-xl border border-border px-3 py-2 text-sm'>
                <option value='text'>Texto curto</option>
                <option value='textarea'>Texto longo</option>
                <option value='date'>Data</option>
                <option value='number'>Numero</option>
                <option value='currency'>Moeda</option>
              </select>
              <input value={newVariableDefault} onChange={(event) => setNewVariableDefault(event.target.value)} placeholder='Valor padrao da empresa' className='rounded-xl border border-border px-3 py-2 text-sm' />
            </div>
            <label className='mt-3 flex items-center gap-2 text-sm'>
              <input type='checkbox' checked={newVariableRequired} onChange={(event) => setNewVariableRequired(event.target.checked)} />
              Obrigatoria para gerar documento
            </label>
            <button type='button' onClick={createCustomVariable} disabled={!newVariableLabel.trim() || saving} className='mt-4 rounded-xl border border-primary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50'>Criar variavel</button>
            {customVariables.length > 0 && (
              <div className='mt-4 flex flex-wrap gap-2'>
                {customVariables.map((variable) => <code key={variable.id} className='rounded-lg bg-primary/5 px-2 py-1 text-xs text-primary'>{`{{custom.${variable.key}}}`}</code>)}
              </div>
            )}
          </div>

          <div className='flex flex-wrap justify-end gap-3 border-t border-border pt-5'>
            {editingTemplate && editingTemplate.status !== 'archived' && <button onClick={() => archive(editingTemplate)} disabled={saving} className='mr-auto px-4 py-3 text-sm font-semibold text-red-700'>Arquivar</button>}
            <button onClick={() => setFormOpen(false)} disabled={saving} className='rounded-xl border border-border px-4 py-3 text-sm font-semibold'>Cancelar</button>
            <button onClick={save} disabled={saving || !name.trim() || !companyId || (!editingTemplate && !file)} className='rounded-xl border border-primary px-4 py-3 text-sm font-semibold text-primary disabled:opacity-50'>
              {file ? editingTemplate ? 'Criar nova versao' : 'Criar modelo' : 'Salvar dados'}
            </button>
            {editingTemplate?.versions.some((version) => version.status === 'draft') && (
              <button onClick={() => publish(editingTemplate)} disabled={saving} className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50'>Publicar rascunho</button>
            )}
          </div>
        </div>
      </FormDrawer>

      <FormDrawer isOpen={guideOpen} title='Variaveis em documentos DOCX' description='Use a sintaxe exatamente como exibida.' onClose={() => setGuideOpen(false)} widthClassName='max-w-4xl'>
        <div className='space-y-6'>
          <div className='rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm leading-6 text-muted'>
            <p><strong className='text-foreground'>Sintaxe:</strong> escreva a variavel com duas chaves, por exemplo <code className='text-primary'>{'{{cliente.nome}}'}</code>.</p>
            <p className='mt-2'>Aplique negrito, fonte, tamanho e alinhamento diretamente no Word ou Google Docs. Evite dividir uma variavel entre estilos diferentes.</p>
            <p className='mt-2'>Exporte do Google Docs como <strong className='text-foreground'>Microsoft Word (.docx)</strong> antes de enviar.</p>
          </div>
          {documentVariableGroups.map((group) => (
            <section key={group.label}>
              <h3 className='font-semibold'>{group.label}</h3>
              <div className='mt-3 grid gap-2 md:grid-cols-2'>
                {group.variables.map(([variable, label]) => (
                  <button key={variable} type='button' onClick={() => navigator.clipboard.writeText(`{{${variable}}}`)} className='flex items-center justify-between rounded-xl border border-border px-3 py-3 text-left'>
                    <span className='text-sm text-muted'>{label}</span>
                    <code className='text-xs text-primary'>{`{{${variable}}}`}</code>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </FormDrawer>

      <FormDrawer isOpen={usageOpen} title='Configurar uso do modelo' description='Selecione os empreendimentos e preencha os dados usados no DOCX publicado.' onClose={() => !saving && setUsageOpen(false)} widthClassName='max-w-4xl'>
        {usageData && (
          <div className='space-y-6'>
            {usageData.developments.map((development) => {
              const selected = usageSelections.includes(development.id)
              return (
                <div key={development.id} className={`rounded-2xl border p-5 ${selected ? 'border-primary bg-primary/3' : 'border-border'}`}>
                  <label className='flex cursor-pointer items-center gap-3'>
                    <input type='checkbox' checked={selected} onChange={() => setUsageSelections((current) => current.includes(development.id) ? current.filter((id) => id !== development.id) : [...current, development.id])} />
                    <span className='font-semibold'>{development.name}</span>
                  </label>
                  {selected && (
                    <div className='mt-5 grid gap-4 md:grid-cols-2'>
                      {usageData.fields.map((field) => (
                        <label key={field.variable} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                          <span className='mb-2 block text-sm font-semibold'>{field.label}{field.required ? ' *' : ''}</span>
                          {field.type === 'textarea' ? (
                            <textarea rows={4} value={usageConfigurations[development.id]?.[field.variable] ?? ''} onChange={(event) => setUsageConfigurations((current) => ({ ...current, [development.id]: { ...current[development.id], [field.variable]: event.target.value } }))} className='w-full rounded-xl border border-border px-4 py-3 text-sm' />
                          ) : (
                            <input value={usageConfigurations[development.id]?.[field.variable] ?? ''} onChange={(event) => setUsageConfigurations((current) => ({ ...current, [development.id]: { ...current[development.id], [field.variable]: event.target.value } }))} className='w-full rounded-xl border border-border px-4 py-3 text-sm' />
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            <div className='flex justify-end gap-3 border-t border-border pt-5'>
              <button onClick={() => setUsageOpen(false)} className='rounded-xl border border-border px-4 py-3 text-sm font-semibold'>Cancelar</button>
              <button onClick={saveUsage} disabled={saving} className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50'>{saving ? 'Salvando...' : 'Salvar e ativar'}</button>
            </div>
          </div>
        )}
      </FormDrawer>
    </div>
  )
}
