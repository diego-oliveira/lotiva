import type { PaymentProvider } from './provider'
import type {
  ListChargesFilter,
  ListChargesResult,
  PaymentCharge,
  PaymentChargeInput,
  PaymentChargeStatus,
  PaymentChargeUpdateInput,
  PaymentCustomer,
  PaymentCustomerInput,
  PaymentEnvironment,
  PixQrCode,
  PaymentWebhookConfig,
} from './types'

type Fetch = typeof fetch

type AsaasCustomer = {
  id: string
  name: string
  cpfCnpj: string
  email?: string
  mobilePhone?: string
  externalReference?: string
  notificationDisabled?: boolean
}

export type AsaasPayment = {
  id: string
  customer: string
  value: number
  dueDate: string
  billingType: PaymentChargeInput['billingType']
  description?: string
  externalReference?: string
  status?: string
  invoiceUrl?: string
  bankSlipUrl?: string
  deleted?: boolean
  netValue?: number
  originalValue?: number
  paymentDate?: string
  clientPaymentDate?: string
  creditDate?: string
  interest?: { value?: number }
  fine?: { value?: number }
}

type AsaasWebhook = {
  id: string
  name: string
  url: string
  enabled: boolean
  interrupted: boolean
}

type AsaasList<T> = {
  data: T[]
  hasMore: boolean
  totalCount: number
}

type AsaasError = {
  errors?: Array<{ code?: string; description?: string }>
}

const baseUrls: Record<PaymentEnvironment, string> = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  production: 'https://api.asaas.com/v3',
}

export function normalizeAsaasApiKey(apiKey: string) {
  return apiKey.trim().replace(/^aact_/, '$aact_')
}

function mapStatus(status?: string): PaymentChargeStatus {
  switch (status) {
    case 'PENDING': return 'pending'
    case 'CONFIRMED': return 'confirmed'
    case 'RECEIVED':
    case 'RECEIVED_IN_CASH': return 'received'
    case 'OVERDUE': return 'overdue'
    case 'REFUNDED':
    case 'PARTIALLY_REFUNDED':
    case 'REFUND_REQUESTED': return 'refunded'
    case 'DELETED': return 'cancelled'
    default: return 'unknown'
  }
}

function mapCustomer(customer: AsaasCustomer): PaymentCustomer {
  return {
    id: customer.id,
    name: customer.name,
    cpfCnpj: customer.cpfCnpj,
    email: customer.email,
    mobilePhone: customer.mobilePhone,
    externalReference: customer.externalReference ?? '',
    notificationDisabled: customer.notificationDisabled,
  }
}

function formatOptionalMoney(value: unknown) {
  if (value === null || value === undefined) return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : undefined
}

export function mapAsaasPayment(payment: AsaasPayment): PaymentCharge {
  const amount = formatOptionalMoney(payment.value) ?? '0.00'
  return {
    id: payment.id,
    customerId: payment.customer,
    amount,
    dueDate: payment.dueDate,
    billingType: payment.billingType,
    description: payment.description ?? '',
    externalReference: payment.externalReference ?? '',
    interest: payment.interest?.value !== undefined
      ? { percentage: String(payment.interest.value) }
      : undefined,
    fine: payment.fine?.value !== undefined
      ? { percentage: String(payment.fine.value) }
      : undefined,
    status: payment.deleted ? 'cancelled' : mapStatus(payment.status),
    invoiceUrl: payment.invoiceUrl,
    bankSlipUrl: payment.bankSlipUrl,
    deleted: payment.deleted,
    paidAmount: payment.originalValue !== null && payment.originalValue !== undefined
      ? formatOptionalMoney(payment.originalValue)
      : ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(payment.status || '')
        ? amount
        : undefined,
    netAmount: formatOptionalMoney(payment.netValue),
    paymentDate: payment.clientPaymentDate || payment.paymentDate,
    creditDate: payment.creditDate,
  }
}

const paymentWebhookEvents = [
  'PAYMENT_CREATED',
  'PAYMENT_UPDATED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_RESTORED',
  'PAYMENT_REFUNDED',
  'PAYMENT_PARTIALLY_REFUNDED',
  'PAYMENT_REFUND_IN_PROGRESS',
  'PAYMENT_REFUND_DENIED',
  'PAYMENT_RECEIVED_IN_CASH_UNDONE',
  'PAYMENT_BANK_SLIP_CANCELLED',
]

export function normalizeWebhookEmail(value?: string) {
  if (!value) return undefined
  const angleBracketMatch = value.match(/<([^>]+)>/)
  const email = (angleBracketMatch?.[1] || value).trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined
}

export class AsaasPaymentProvider implements PaymentProvider {
  readonly name = 'asaas' as const
  private readonly baseUrl: string
  private readonly apiKey: string

  constructor(
    apiKey: string,
    environment: PaymentEnvironment = 'sandbox',
    private readonly fetcher: Fetch = fetch,
  ) {
    if (!apiKey.trim()) throw new Error('A chave da API Asaas e obrigatoria.')
    // dotenv-expand treats the leading "$" in Asaas keys as interpolation.
    // Accept the stripped form to avoid silently sending an invalid key.
    this.apiKey = normalizeAsaasApiKey(apiKey)
    this.baseUrl = baseUrls[environment]
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        access_token: this.apiKey,
        'user-agent': 'Lotiva/0.1',
        ...init.headers,
      },
    })

    const body = await response.json().catch(() => null) as T | AsaasError | null
    if (!response.ok) {
      const descriptions = (body as AsaasError | null)?.errors
        ?.map((error) => error.description || error.code)
        .filter(Boolean)
        .join('; ')
      throw new Error(`Asaas ${response.status}: ${descriptions || response.statusText || 'erro desconhecido'}`)
    }
    return body as T
  }

  async createCustomer(input: PaymentCustomerInput) {
    const customer = await this.request<AsaasCustomer>('/customers', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return mapCustomer(customer)
  }

  async findCustomerByDocument(cpfCnpj: string) {
    const query = new URLSearchParams({ cpfCnpj, limit: '1' })
    const result = await this.request<AsaasList<AsaasCustomer>>(`/customers?${query}`)
    return result.data[0] ? mapCustomer(result.data[0]) : null
  }

  async createCharge(input: PaymentChargeInput) {
    const payment = await this.request<AsaasPayment>('/payments', {
      method: 'POST',
      body: JSON.stringify({
        customer: input.customerId,
        billingType: input.billingType,
        value: Number(input.amount),
        dueDate: input.dueDate,
        description: input.description,
        externalReference: input.externalReference,
        interest: input.interest ? { value: Number(input.interest.percentage) } : undefined,
        fine: input.fine ? { value: Number(input.fine.percentage) } : undefined,
      }),
    })
    return mapAsaasPayment(payment)
  }

  async updateCharge(chargeId: string, input: PaymentChargeUpdateInput) {
    const payment = await this.request<AsaasPayment>(`/payments/${encodeURIComponent(chargeId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        billingType: input.billingType,
        value: Number(input.amount),
        dueDate: input.dueDate,
        description: input.description,
        externalReference: input.externalReference,
        interest: input.interest ? { value: Number(input.interest.percentage) } : undefined,
        fine: input.fine ? { value: Number(input.fine.percentage) } : undefined,
      }),
    })
    return mapAsaasPayment(payment)
  }

  async getCharge(chargeId: string) {
    return mapAsaasPayment(await this.request<AsaasPayment>(`/payments/${encodeURIComponent(chargeId)}`))
  }

  async listCharges(filter: ListChargesFilter = {}): Promise<ListChargesResult> {
    const query = new URLSearchParams()
    if (filter.customerId) query.set('customer', filter.customerId)
    if (filter.externalReference) query.set('externalReference', filter.externalReference)
    if (filter.offset !== undefined) query.set('offset', String(filter.offset))
    if (filter.limit !== undefined) query.set('limit', String(filter.limit))

    const result = await this.request<AsaasList<AsaasPayment>>(`/payments?${query}`)
    return {
      charges: result.data.map(mapAsaasPayment),
      hasMore: result.hasMore,
      totalCount: result.totalCount,
    }
  }

  async cancelCharge(chargeId: string) {
    return mapAsaasPayment(await this.request<AsaasPayment>(`/payments/${encodeURIComponent(chargeId)}`, {
      method: 'DELETE',
    }))
  }

  async getPixQrCode(chargeId: string) {
    return this.request<PixQrCode>(`/payments/${encodeURIComponent(chargeId)}/pixQrCode`)
  }

  async ensurePaymentWebhook(input: {
    id?: string | null
    name: string
    url: string
    email?: string
    authToken: string
  }): Promise<PaymentWebhookConfig> {
    const listed = await this.request<AsaasList<AsaasWebhook>>('/webhooks?limit=100')
    const existing = listed.data.find((webhook) => webhook.id === input.id || webhook.url === input.url)
    const payload = {
      name: input.name,
      url: input.url,
      email: input.email,
      enabled: true,
      interrupted: false,
      authToken: input.authToken,
      sendType: 'SEQUENTIALLY',
      events: paymentWebhookEvents,
    }
    const webhook = existing
      ? await this.request<AsaasWebhook>(`/webhooks/${encodeURIComponent(existing.id)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      : await this.request<AsaasWebhook>('/webhooks', {
          method: 'POST',
          body: JSON.stringify(payload),
        })

    return {
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      enabled: webhook.enabled,
      interrupted: webhook.interrupted,
    }
  }
}
