'use client'

import { useEffect, useState } from 'react'
import FormDrawer from '@/app/components/FormDrawer'
import { NumberTextInput } from '@/app/components/NumberTextInput'

type Development = {
  id: string
  name: string
}

type DevelopmentSettings = {
  reservationValidityDays: number
  defaultInterestRate: number
  interestCalculation: 'none' | 'simple' | 'compound'
  correctionIndex: 'none' | 'ipca' | 'incc' | 'igpm' | 'fixed'
  correctionFrequency: 'monthly' | 'annual'
  autoIssueBoleto: boolean
  autoIssueBoletoDaysBefore: number
  automaticBoletoProvider: 'auto' | 'asaas' | 'inter'
  autoSendBoletoEmail: boolean
  overdueEmailEnabled: boolean
  overdueFirstReminderDays: number
  overdueSecondReminderDays: number
  boletoEmailSubject: string
  boletoEmailTemplate: string
  overdueEmailSubject: string
  overdueEmailTemplate: string
  overdueSecondEmailSubject: string
  overdueSecondEmailTemplate: string
  minDownPaymentPercentage: number
  defaultCommissionPercentage: number
  allowDownPaymentInstallments: boolean
  maxDownPaymentInstallments: number
  maxInstallments: number
  paymentMethods: string[]
  allowCustomTerms: boolean
}

type DevelopmentSettingsFormProps = {
  development: Development | null
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

const defaultSettings: DevelopmentSettings = {
  reservationValidityDays: 7,
  defaultInterestRate: 0,
  interestCalculation: 'none',
  correctionIndex: 'none',
  correctionFrequency: 'monthly',
  autoIssueBoleto: false,
  autoIssueBoletoDaysBefore: 7,
  automaticBoletoProvider: 'auto',
  autoSendBoletoEmail: false,
  overdueEmailEnabled: false,
  overdueFirstReminderDays: 3,
  overdueSecondReminderDays: 10,
  boletoEmailSubject: 'Boleto da parcela - {{empreendimento}}',
  boletoEmailTemplate: 'Olá, {{cliente}}!\n\nSegue o boleto da parcela {{parcela}} do empreendimento {{empreendimento}}, no valor de {{valor}}, com vencimento em {{vencimento}}.\n\n{{link_boleto}}\n\nSe já realizou o pagamento, desconsidere esta mensagem.',
  overdueEmailSubject: 'Parcela em aberto - {{empreendimento}}',
  overdueEmailTemplate: 'Olá, {{cliente}}!\n\nA parcela {{parcela}} do empreendimento {{empreendimento}}, no valor de {{valor}}, venceu em {{vencimento}} e consta em aberto.\n\n{{link_boleto}}\n\nSe já realizou o pagamento, desconsidere esta mensagem.',
  overdueSecondEmailSubject: 'Segundo aviso de parcela em aberto - {{empreendimento}}',
  overdueSecondEmailTemplate: 'Olá, {{cliente}}!\n\nEsta é uma nova tentativa de contato sobre a parcela {{parcela}} do empreendimento {{empreendimento}}, no valor de {{valor}}, vencida em {{vencimento}}. Ela ainda consta em aberto em nosso sistema.\n\n{{link_boleto}}\n\nSe já realizou o pagamento, desconsidere esta mensagem.',
  minDownPaymentPercentage: 10,
  defaultCommissionPercentage: 6,
  allowDownPaymentInstallments: false,
  maxDownPaymentInstallments: 1,
  maxInstallments: 120,
  paymentMethods: ['cash', 'installments'],
  allowCustomTerms: true,
}

const paymentMethodOptions = [
  { value: 'cash', label: 'A vista' },
  { value: 'installments', label: 'Parcelamento proprio' },
  { value: 'financing', label: 'Financiamento' },
  { value: 'bank_slip', label: 'Boleto' },
  { value: 'pix', label: 'Pix' },
]

function NumberInput({
  label,
  name,
  value,
  min,
  max,
  step = '1',
  suffix,
  errors,
  onChange,
}: {
  label: string
  name: keyof DevelopmentSettings
  value: number
  min: number
  max: number
  step?: string
  suffix?: string
  errors: Record<string, string>
  onChange: (name: keyof DevelopmentSettings, value: number) => void
}) {
  return (
    <label className='block'>
      <span className='mb-2 block text-sm font-semibold text-foreground'>{label}</span>
      <div className='relative'>
        <NumberTextInput
          min={min}
          max={max}
          step={step}
          value={value}
          onValueChange={(nextValue) => onChange(name, nextValue)}
          className={`w-full rounded-xl border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary ${
            errors[name] ? 'border-red-300' : 'border-border'
          }`}
        />
        {suffix && <span className='pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted'>{suffix}</span>}
      </div>
      {errors[name] && <p className='mt-2 text-sm text-red-600'>{errors[name]}</p>}
    </label>
  )
}

export default function DevelopmentSettingsForm({
  development,
  isOpen,
  onClose,
  onSave,
}: DevelopmentSettingsFormProps) {
  const [formData, setFormData] = useState<DevelopmentSettings>(defaultSettings)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    async function fetchSettings() {
      if (!development || !isOpen) return

      try {
        setLoading(true)
        setErrors({})
        const response = await fetch(`/api/developments/${development.id}/settings`, { cache: 'no-store' })
        if (!response.ok) throw new Error('Erro ao carregar configuracoes')
        const settings = await response.json()
        setFormData({
          reservationValidityDays: settings.reservationValidityDays,
          defaultInterestRate: settings.defaultInterestRate,
          interestCalculation: settings.interestCalculation,
          correctionIndex: settings.correctionIndex,
          correctionFrequency: settings.correctionFrequency,
          autoIssueBoleto: settings.autoIssueBoleto,
          autoIssueBoletoDaysBefore: settings.autoIssueBoletoDaysBefore,
          automaticBoletoProvider: settings.automaticBoletoProvider,
          autoSendBoletoEmail: settings.autoSendBoletoEmail,
          overdueEmailEnabled: settings.overdueEmailEnabled,
          overdueFirstReminderDays: settings.overdueFirstReminderDays,
          overdueSecondReminderDays: settings.overdueSecondReminderDays,
          boletoEmailSubject: settings.boletoEmailSubject,
          boletoEmailTemplate: settings.boletoEmailTemplate,
          overdueEmailSubject: settings.overdueEmailSubject,
          overdueEmailTemplate: settings.overdueEmailTemplate,
          overdueSecondEmailSubject: settings.overdueSecondEmailSubject,
          overdueSecondEmailTemplate: settings.overdueSecondEmailTemplate,
          minDownPaymentPercentage: settings.minDownPaymentPercentage,
          defaultCommissionPercentage: settings.defaultCommissionPercentage,
          allowDownPaymentInstallments: settings.allowDownPaymentInstallments,
          maxDownPaymentInstallments: settings.maxDownPaymentInstallments,
          maxInstallments: settings.maxInstallments,
          paymentMethods: settings.paymentMethods,
          allowCustomTerms: settings.allowCustomTerms,
        })
      } catch (error) {
        setErrors({ submit: error instanceof Error ? error.message : 'Erro ao carregar configuracoes' })
      } finally {
        setLoading(false)
      }
    }

    void fetchSettings()
  }, [development, isOpen])

  const updateNumber = (name: keyof DevelopmentSettings, value: number) => {
    setFormData((current) => ({ ...current, [name]: Number.isFinite(value) ? value : 0 }))
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  const updateText = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  const togglePaymentMethod = (method: string) => {
    setFormData((current) => {
      const selected = current.paymentMethods.includes(method)
        ? current.paymentMethods.filter((item) => item !== method)
        : [...current.paymentMethods, method]

      return { ...current, paymentMethods: selected }
    })
    setErrors((current) => ({ ...current, paymentMethods: '' }))
  }

  const validate = () => {
    const nextErrors: Record<string, string> = {}
    if (formData.reservationValidityDays < 1 || formData.reservationValidityDays > 180) nextErrors.reservationValidityDays = 'Informe entre 1 e 180 dias.'
    if (formData.defaultInterestRate < 0 || formData.defaultInterestRate > 10) nextErrors.defaultInterestRate = 'Informe entre 0% e 10% ao mes.'
    if (formData.minDownPaymentPercentage < 0 || formData.minDownPaymentPercentage > 100) nextErrors.minDownPaymentPercentage = 'Informe entre 0% e 100%.'
    if (formData.defaultCommissionPercentage < 0 || formData.defaultCommissionPercentage > 100) nextErrors.defaultCommissionPercentage = 'Informe entre 0% e 100%.'
    if (formData.maxInstallments < 1 || formData.maxInstallments > 240) nextErrors.maxInstallments = 'Informe ate 240 parcelas.'
    if (formData.allowDownPaymentInstallments && (formData.maxDownPaymentInstallments < 2 || formData.maxDownPaymentInstallments > 24)) nextErrors.maxDownPaymentInstallments = 'Informe entre 2 e 24 parcelas.'
    if (formData.paymentMethods.length === 0) nextErrors.paymentMethods = 'Selecione pelo menos uma forma de pagamento.'
    if (formData.autoIssueBoletoDaysBefore < 1 || formData.autoIssueBoletoDaysBefore > 60) nextErrors.autoIssueBoletoDaysBefore = 'Informe entre 1 e 60 dias.'
    if (formData.overdueFirstReminderDays < 1 || formData.overdueFirstReminderDays > 60) nextErrors.overdueFirstReminderDays = 'Informe entre 1 e 60 dias.'
    if (formData.overdueSecondReminderDays <= formData.overdueFirstReminderDays || formData.overdueSecondReminderDays > 90) nextErrors.overdueSecondReminderDays = 'O segundo aviso deve ser posterior ao primeiro e ocorrer em ate 90 dias.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!development || !validate()) return

    try {
      setSaving(true)
      const response = await fetch(`/api/developments/${development.id}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const payload = await response.json()
        if (payload.errors) setErrors(payload.errors)
        throw new Error(payload.error || 'Erro ao salvar configuracoes')
      }

      onSave()
      onClose()
    } catch (error) {
      setErrors((current) => ({
        ...current,
        submit: error instanceof Error ? error.message : 'Erro ao salvar configuracoes',
      }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDrawer
      isOpen={isOpen}
      title='Configuracoes comerciais'
      description={development ? `Defina regras padrao para ${development.name}.` : 'Defina as regras comerciais do empreendimento.'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className='space-y-6'>
        {errors.submit && (
          <div className='rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'>
            {errors.submit}
          </div>
        )}

        {loading ? (
          <div className='space-y-4'>
            <div className='h-24 animate-pulse rounded-2xl bg-surface-secondary' />
            <div className='h-24 animate-pulse rounded-2xl bg-surface-secondary' />
            <div className='h-24 animate-pulse rounded-2xl bg-surface-secondary' />
          </div>
        ) : (
          <>
            <section className='rounded-2xl border border-border bg-surface-secondary p-5'>
              <h3 className='text-sm font-semibold text-foreground'>Reserva e negociacao</h3>
              <div className='mt-4 grid gap-4 md:grid-cols-2'>
                <NumberInput label='Prazo de reserva' name='reservationValidityDays' value={formData.reservationValidityDays} min={1} max={180} suffix='dias' errors={errors} onChange={updateNumber} />
                <NumberInput label='Entrada minima' name='minDownPaymentPercentage' value={formData.minDownPaymentPercentage} min={0} max={100} step='0.01' suffix='%' errors={errors} onChange={updateNumber} />
                <NumberInput label='Comissao padrao' name='defaultCommissionPercentage' value={formData.defaultCommissionPercentage} min={0} max={100} step='0.01' suffix='%' errors={errors} onChange={updateNumber} />
              </div>
              <label className='mt-4 flex items-center gap-3 text-sm font-medium text-foreground'>
                <input type='checkbox' checked={formData.allowDownPaymentInstallments} onChange={(event) => setFormData((current) => ({ ...current, allowDownPaymentInstallments: event.target.checked, maxDownPaymentInstallments: event.target.checked ? Math.max(current.maxDownPaymentInstallments, 2) : 1 }))} className='h-4 w-4 rounded border-border text-primary focus:ring-primary' />
                Permitir parcelamento da entrada
              </label>
              {formData.allowDownPaymentInstallments && (
                <div className='mt-4 max-w-xs'>
                  <NumberInput label='Maximo de parcelas da entrada' name='maxDownPaymentInstallments' value={formData.maxDownPaymentInstallments} min={2} max={24} errors={errors} onChange={updateNumber} />
                </div>
              )}
              <label className='mt-4 flex items-center gap-3 text-sm font-medium text-foreground'>
                <input
                  type='checkbox'
                  checked={formData.allowCustomTerms}
                  onChange={(event) => setFormData((current) => ({ ...current, allowCustomTerms: event.target.checked }))}
                  className='h-4 w-4 rounded border-border text-primary focus:ring-primary'
                />
                Permitir condicoes fora do padrao
              </label>
            </section>

            <section className='rounded-2xl border border-border bg-surface-secondary p-5'>
              <h3 className='text-sm font-semibold text-foreground'>Juros e correcao</h3>
              <div className='mt-4 grid gap-4 md:grid-cols-2'>
                <NumberInput label='Juros padrao' name='defaultInterestRate' value={formData.defaultInterestRate} min={0} max={10} step='0.01' suffix='% a.m.' errors={errors} onChange={updateNumber} />
                <label className='block'>
                  <span className='mb-2 block text-sm font-semibold text-foreground'>Calculo de juros</span>
                  <select name='interestCalculation' value={formData.interestCalculation} onChange={updateText} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary'>
                    <option value='none'>Sem juros</option>
                    <option value='simple'>Juros simples</option>
                    <option value='compound'>Juros compostos</option>
                  </select>
                </label>
                <label className='block'>
                  <span className='mb-2 block text-sm font-semibold text-foreground'>Indice de correcao</span>
                  <select name='correctionIndex' value={formData.correctionIndex} onChange={updateText} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary'>
                    <option value='none'>Sem correcao</option>
                    <option value='ipca'>IPCA</option>
                    <option value='incc'>INCC</option>
                    <option value='igpm'>IGP-M</option>
                    <option value='fixed'>Percentual fixo</option>
                  </select>
                </label>
                <label className='block'>
                  <span className='mb-2 block text-sm font-semibold text-foreground'>Periodicidade</span>
                  <select name='correctionFrequency' value={formData.correctionFrequency} onChange={updateText} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-primary'>
                    <option value='monthly'>Mensal</option>
                    <option value='annual'>Anual</option>
                  </select>
                </label>
              </div>
            </section>

            <section className='rounded-2xl border border-border bg-surface-secondary p-5'>
              <h3 className='text-sm font-semibold text-foreground'>Pagamento</h3>
              <div className='mt-4'>
                <NumberInput label='Maximo de parcelas' name='maxInstallments' value={formData.maxInstallments} min={1} max={240} errors={errors} onChange={updateNumber} />
              </div>
              <div className='mt-5'>
                <p className='mb-3 text-sm font-semibold text-foreground'>Formas permitidas</p>
                <div className='grid gap-3 md:grid-cols-2'>
                  {paymentMethodOptions.map((option) => (
                    <label key={option.value} className='flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground'>
                      <input
                        type='checkbox'
                        checked={formData.paymentMethods.includes(option.value)}
                        onChange={() => togglePaymentMethod(option.value)}
                        className='h-4 w-4 rounded border-border text-primary focus:ring-primary'
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                {errors.paymentMethods && <p className='mt-2 text-sm text-red-600'>{errors.paymentMethods}</p>}
              </div>
            </section>

            <section className='rounded-2xl border border-border bg-surface-secondary p-5'>
              <h3 className='text-sm font-semibold text-foreground'>Automação de cobranças</h3>
              <p className='mt-1 text-xs leading-5 text-muted'>As rotinas são executadas diariamente. Boletos dependentes de reajuste aguardam a aprovação do valor.</p>
              <label className='mt-4 flex items-center gap-3 text-sm font-medium text-foreground'>
                <input type='checkbox' checked={formData.autoIssueBoleto} onChange={(event) => setFormData((current) => ({ ...current, autoIssueBoleto: event.target.checked }))} className='h-4 w-4 rounded border-border text-primary focus:ring-primary' />
                Gerar boletos automaticamente antes do vencimento
              </label>
              {formData.autoIssueBoleto && <div className='mt-4 grid gap-4 sm:grid-cols-2'>
                <label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>Provedor para emissão automática</span><select name='automaticBoletoProvider' value={formData.automaticBoletoProvider} onChange={updateText} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground'><option value='auto'>Usar automaticamente se houver apenas um ativo</option><option value='asaas'>Asaas</option><option value='inter'>Banco Inter</option></select><p className='mt-2 text-xs text-muted'>Se houver mais de um provedor ativo, escolha qual deve emitir.</p></label>
                <div className='max-w-xs'><NumberInput label='Gerar com antecedência' name='autoIssueBoletoDaysBefore' value={formData.autoIssueBoletoDaysBefore} min={1} max={60} suffix='dias' errors={errors} onChange={updateNumber} /></div>
              </div>}
              <label className='mt-4 flex items-center gap-3 text-sm font-medium text-foreground'>
                <input type='checkbox' checked={formData.autoSendBoletoEmail} onChange={(event) => setFormData((current) => ({ ...current, autoSendBoletoEmail: event.target.checked }))} className='h-4 w-4 rounded border-border text-primary focus:ring-primary' />
                Enviar o boleto por e-mail quando estiver disponível
              </label>
              {formData.autoSendBoletoEmail && <div className='mt-4 space-y-3'>
                <label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>Assunto do e-mail</span><input value={formData.boletoEmailSubject} onChange={(event) => setFormData((current) => ({ ...current, boletoEmailSubject: event.target.value }))} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground' /></label>
                <label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>Mensagem</span><textarea rows={6} value={formData.boletoEmailTemplate} onChange={(event) => setFormData((current) => ({ ...current, boletoEmailTemplate: event.target.value }))} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground' /></label>
              </div>}
              <label className='mt-5 flex items-center gap-3 text-sm font-medium text-foreground'>
                <input type='checkbox' checked={formData.overdueEmailEnabled} onChange={(event) => setFormData((current) => ({ ...current, overdueEmailEnabled: event.target.checked }))} className='h-4 w-4 rounded border-border text-primary focus:ring-primary' />
                Enviar avisos de inadimplência por e-mail
              </label>
              {formData.overdueEmailEnabled && <div className='mt-4 space-y-3'>
                <div className='grid gap-4 sm:grid-cols-2'><NumberInput label='Primeiro aviso após o vencimento' name='overdueFirstReminderDays' value={formData.overdueFirstReminderDays} min={1} max={60} suffix='dias' errors={errors} onChange={updateNumber} /><NumberInput label='Segundo aviso após o vencimento' name='overdueSecondReminderDays' value={formData.overdueSecondReminderDays} min={2} max={90} suffix='dias' errors={errors} onChange={updateNumber} /></div>
                <label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>Assunto do e-mail</span><input value={formData.overdueEmailSubject} onChange={(event) => setFormData((current) => ({ ...current, overdueEmailSubject: event.target.value }))} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground' /></label>
                <label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>Mensagem</span><textarea rows={6} value={formData.overdueEmailTemplate} onChange={(event) => setFormData((current) => ({ ...current, overdueEmailTemplate: event.target.value }))} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground' /></label>
                <div className='border-t border-border pt-4'><p className='mb-3 text-sm font-semibold text-foreground'>Segundo aviso</p>
                  <label className='mb-3 block'><span className='mb-2 block text-sm font-semibold text-foreground'>Assunto do e-mail</span><input value={formData.overdueSecondEmailSubject} onChange={(event) => setFormData((current) => ({ ...current, overdueSecondEmailSubject: event.target.value }))} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground' /></label>
                  <label className='block'><span className='mb-2 block text-sm font-semibold text-foreground'>Mensagem</span><textarea rows={6} value={formData.overdueSecondEmailTemplate} onChange={(event) => setFormData((current) => ({ ...current, overdueSecondEmailTemplate: event.target.value }))} className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground' /></label>
                </div>
              </div>}
              <p className='mt-4 text-xs leading-5 text-muted'>Variáveis: {'{{cliente}}'}, {'{{empreendimento}}'}, {'{{parcela}}'}, {'{{valor}}'}, {'{{vencimento}}'} e {'{{link_boleto}}'}.</p>
            </section>
          </>
        )}

        <div className='flex justify-end gap-3 border-t border-border pt-6'>
          <button type='button' onClick={onClose} disabled={saving} className='rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-surface-secondary disabled:opacity-50'>Cancelar</button>
          <button type='submit' disabled={saving || loading} className='rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-strong disabled:opacity-50'>
            {saving ? 'Salvando...' : 'Salvar configuracoes'}
          </button>
        </div>
      </form>
    </FormDrawer>
  )
}
