import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email/send-email'
import { getPaymentProviderForConnection } from './factory'
import { InterPaymentProvider } from './inter-provider'
import { issueReceivableCharge } from './billing-cycle'

function dayStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addDays(date: Date, days: number) {
  const result = dayStart(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function dayDifference(later: Date, earlier: Date) {
  return Math.floor((dayStart(later).getTime() - dayStart(earlier).getTime()) / 86_400_000)
}

function brDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date)
}

function brCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function renderTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_match, key: string) => variables[key.toLowerCase()] ?? '')
}

async function claimEmail(input: { receivableId: string; category: string; key: string; message: string }) {
  const now = new Date()
  const staleBefore = new Date(now.getTime() - 30 * 60_000)
  const existing = await prisma.receivableContactLog.findUnique({ where: { deduplicationKey: input.key } })
  if (!existing) {
    try {
      return await prisma.receivableContactLog.create({
        data: { receivableId: input.receivableId, category: input.category, channel: 'email', source: 'automatic', deliveryStatus: 'pending', deduplicationKey: input.key, message: input.message },
      })
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return null
      throw error
    }
  }
  if (existing.deliveryStatus === 'sent' || (existing.deliveryStatus === 'pending' && existing.updatedAt > staleBefore)) return null
  const claimed = await prisma.receivableContactLog.updateMany({
    where: { id: existing.id, updatedAt: existing.updatedAt, deliveryStatus: existing.deliveryStatus },
    data: { deliveryStatus: 'pending', message: input.message },
  })
  return claimed.count ? { ...existing, deliveryStatus: 'pending' } : null
}

async function sendLoggedEmail(input: {
  receivableId: string
  category: 'boleto' | 'overdue'
  key: string
  to: string
  subject: string
  message: string
  attachments?: { filename: string; content: Buffer; contentType: string }[]
}) {
  const log = await claimEmail({ receivableId: input.receivableId, category: input.category, key: input.key, message: input.message })
  if (!log) return false
  try {
    await sendEmail({ to: input.to, subject: input.subject, text: input.message, attachments: input.attachments })
    await prisma.receivableContactLog.update({ where: { id: log.id }, data: { deliveryStatus: 'sent' } })
    return true
  } catch (error) {
    await prisma.receivableContactLog.update({ where: { id: log.id }, data: { deliveryStatus: 'failed' } })
    throw error
  }
}

async function boletoEmailContent(input: {
  settings: { boletoEmailSubject: string; boletoEmailTemplate: string }
  receivable: { id: string; kind: string; sequence: number; dueDate: Date; balance: unknown; amount: unknown; sale: { user: { name: string; email: string }; lot: { block: { development: { name: string } | null } } } }
  charge: { id: string; providerChargeId: string; connectionId: string; invoiceUrl: string | null; bankSlipUrl: string | null }
}) {
  let link = input.charge.invoiceUrl || input.charge.bankSlipUrl || ''
  let attachment: { filename: string; content: Buffer; contentType: string } | undefined
  const { provider } = await getPaymentProviderForConnection(input.charge.connectionId)
  if (provider instanceof InterPaymentProvider) {
    const pdf = await provider.getChargePdfBase64(input.charge.providerChargeId)
    attachment = { filename: `boleto-${input.charge.id}.pdf`, content: Buffer.from(pdf, 'base64'), contentType: 'application/pdf' }
    link = 'O boleto está anexado a este e-mail.'
  }
  const variables = {
    cliente: input.receivable.sale.user.name,
    empreendimento: input.receivable.sale.lot.block.development?.name ?? 'empreendimento',
    parcela: input.receivable.kind === 'down_payment' ? 'Entrada' : `Parcela ${input.receivable.sequence}`,
    valor: brCurrency(Number(input.receivable.balance ?? input.receivable.amount)),
    vencimento: brDate(input.receivable.dueDate),
    link_boleto: link || 'Entre em contato conosco para receber o boleto.',
  }
  return {
    to: input.receivable.sale.user.email,
    subject: renderTemplate(input.settings.boletoEmailSubject, variables),
    message: renderTemplate(input.settings.boletoEmailTemplate, variables),
    attachments: attachment ? [attachment] : undefined,
  }
}

export async function processAutomaticCollections(
  now = new Date(),
  scope: { developmentId?: string; receivableId?: string } = {},
) {
  const settingsList = await prisma.developmentSettings.findMany({
    where: {
      ...(scope.developmentId ? { developmentId: scope.developmentId } : {}),
      OR: [{ autoIssueBoleto: true }, { autoSendBoletoEmail: true }, { overdueEmailEnabled: true }],
    },
    include: { development: { select: { id: true, name: true, companyId: true } } },
  })
  const report = { developments: settingsList.length, issued: 0, boletoEmailsSent: 0, overdueEmailsSent: 0, providerSelectionRequired: 0, skipped: 0, failed: 0 }
  const today = dayStart(now)

  for (const settings of settingsList) {
    const paymentEnvironment = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
    const activeConnections = settings.autoIssueBoleto
      ? await prisma.paymentProviderConnection.findMany({
          where: { companyId: settings.development.companyId, status: 'active', environment: paymentEnvironment },
          orderBy: [{ provider: 'asc' }, { createdAt: 'asc' }],
        })
      : []
    const connection = !settings.autoIssueBoleto
      ? null
      : settings.automaticBoletoProvider === 'auto'
        ? activeConnections.length === 1 ? activeConnections[0] : null
        : activeConnections.find((item) => item.provider === settings.automaticBoletoProvider) ?? null
    if (settings.autoIssueBoleto && !connection) {
      report.skipped += 1
      if (settings.automaticBoletoProvider === 'auto' && activeConnections.length > 1) {
        report.providerSelectionRequired += 1
        console.warn('[automatic-collections] provider selection required', { developmentId: settings.developmentId, activeProviders: activeConnections.map((item) => item.provider) })
      }
    }

    const horizon = new Date(addDays(today, settings.autoIssueBoletoDaysBefore).getTime() + 86_400_000 - 1)
    const dueSoon = (connection || settings.autoSendBoletoEmail) && (settings.autoIssueBoleto || settings.autoSendBoletoEmail)
      ? await prisma.receivable.findMany({
          where: {
            ...(scope.receivableId ? { id: scope.receivableId } : {}),
            status: { not: 'paid' },
            balance: { gt: 0 },
            dueDate: { gte: today, lte: horizon },
            sale: { is: { lot: { is: { block: { is: { developmentId: settings.developmentId } } } } } },
          },
          include: {
            sale: {
              include: {
                user: true,
                billingCycles: { where: { connectionId: connection?.id ?? '__no_selected_connection__', status: 'issued' }, orderBy: { cycleNumber: 'desc' }, take: 1 },
                lot: { include: { block: { include: { development: { select: { name: true } } } } } },
              },
            },
            externalCharges: { orderBy: { version: 'desc' } },
          },
          orderBy: { dueDate: 'asc' },
        })
      : []

    for (const receivable of dueSoon) {
      let charge = receivable.externalCharges.find((item) => !['cancelled', 'refunded'].includes(item.status))
      if (!charge && settings.autoIssueBoleto) {
        if (!connection) { report.skipped += 1; continue }
        const cycle = receivable.sale.billingCycles[0]
        const requiresAdjustmentCycle = receivable.sale.annualAdjustment && receivable.kind === 'installment'
        if (requiresAdjustmentCycle && (!cycle || receivable.sequence > cycle.endSequence)) {
          report.skipped += 1
          continue
        }
        try {
          const { provider } = await getPaymentProviderForConnection(connection!.id)
          const result = await issueReceivableCharge({ connectionId: connection!.id, receivableId: receivable.id, provider, billingType: 'BOLETO', actorId: null })
          charge = result.charge
          if (!result.alreadyComplete) report.issued += 1
        } catch (error) {
          report.failed += 1
          console.error('[automatic-collections] boleto issuance failed', { receivableId: receivable.id, error: error instanceof Error ? error.message : String(error) })
          continue
        }
      }
      if (settings.autoSendBoletoEmail && receivable.sale.user.email && charge && !['confirmed', 'received', 'paid'].includes(charge.status)) {
        try {
          const content = await boletoEmailContent({ settings, receivable, charge })
          const sent = await sendLoggedEmail({ ...content, receivableId: receivable.id, category: 'boleto', key: `auto:boleto:${charge.id}` })
          if (sent) report.boletoEmailsSent += 1
        } catch (error) {
          report.failed += 1
          console.error('[automatic-collections] boleto email failed', { receivableId: receivable.id, error: error instanceof Error ? error.message : String(error) })
        }
      }
    }

    if (!settings.overdueEmailEnabled) continue
    const overdue = await prisma.receivable.findMany({
      where: {
        ...(scope.receivableId ? { id: scope.receivableId } : {}),
        status: { not: 'paid' },
        balance: { gt: 0 },
        dueDate: { lt: today },
        sale: { is: { lot: { is: { block: { is: { developmentId: settings.developmentId } } } } } },
      },
      include: {
        sale: { include: { user: true, lot: { include: { block: { include: { development: { select: { name: true } } } } } } } },
        externalCharges: { where: { status: { notIn: ['cancelled', 'refunded'] } }, orderBy: { version: 'desc' }, take: 1, include: { connection: { select: { provider: true } } } },
      },
      orderBy: { dueDate: 'asc' },
    })
    for (const receivable of overdue) {
      if (!receivable.sale.user.email) { report.skipped += 1; continue }
      const age = dayDifference(today, receivable.dueDate)
      const charge = receivable.externalCharges[0]
      const firstKey = `auto:overdue:${receivable.id}:${dateKey(receivable.dueDate)}:first`
      const firstLog = await prisma.receivableContactLog.findUnique({ where: { deduplicationKey: firstKey }, select: { deliveryStatus: true, createdAt: true } })
      const steps: { name: string }[] = []
      if (age >= settings.overdueFirstReminderDays && firstLog?.deliveryStatus !== 'sent') steps.push({ name: 'first' })
      if (age >= settings.overdueSecondReminderDays && firstLog?.deliveryStatus === 'sent' && firstLog.createdAt < today) steps.push({ name: 'second' })
      for (const step of steps) {
        const key = `auto:overdue:${receivable.id}:${dateKey(receivable.dueDate)}:${step.name}`
        let overdueLink = charge?.invoiceUrl || charge?.bankSlipUrl || ''
        let overdueAttachments: { filename: string; content: Buffer; contentType: string }[] | undefined
        if (charge?.connection.provider === 'inter') {
          try {
            const { provider } = await getPaymentProviderForConnection(charge.connectionId)
            if (provider instanceof InterPaymentProvider) {
              const pdf = await provider.getChargePdfBase64(charge.providerChargeId)
              overdueAttachments = [{ filename: `boleto-${charge.id}.pdf`, content: Buffer.from(pdf, 'base64'), contentType: 'application/pdf' }]
              overdueLink = 'O boleto atualizado está anexado a este e-mail.'
            }
          } catch (error) {
            console.error('[automatic-collections] overdue boleto attachment failed', { receivableId: receivable.id, error: error instanceof Error ? error.message : String(error) })
          }
        }
        const variables = {
          cliente: receivable.sale.user.name,
          empreendimento: receivable.sale.lot.block.development?.name ?? 'empreendimento',
          parcela: receivable.kind === 'down_payment' ? 'Entrada' : `Parcela ${receivable.sequence}`,
          valor: brCurrency(Number(receivable.balance)),
          vencimento: brDate(receivable.dueDate),
          link_boleto: overdueLink || 'Entre em contato conosco para receber o boleto atualizado.',
        }
        try {
        const subjectTemplate = step.name === 'second' ? settings.overdueSecondEmailSubject : settings.overdueEmailSubject
        const messageTemplate = step.name === 'second' ? settings.overdueSecondEmailTemplate : settings.overdueEmailTemplate
          const sent = await sendLoggedEmail({
            receivableId: receivable.id,
            category: 'overdue',
            key,
            to: receivable.sale.user.email,
            subject: renderTemplate(subjectTemplate, variables),
            message: renderTemplate(messageTemplate, variables),
            attachments: overdueAttachments,
          })
          if (sent) report.overdueEmailsSent += 1
        } catch (error) {
          report.failed += 1
          console.error('[automatic-collections] overdue email failed', { receivableId: receivable.id, step: step.name, error: error instanceof Error ? error.message : String(error) })
        }
      }
    }
  }
  return report
}
