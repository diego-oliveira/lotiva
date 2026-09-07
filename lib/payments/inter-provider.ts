import https from 'https'
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
  PaymentWebhookConfig,
  PixQrCode,
} from './types'

type InterCredentials = {
  clientId: string
  clientSecret: string
  certificate: string
  privateKey: string
  accountNumber?: string
}

type InterToken = {
  access_token: string
  token_type?: string
  expires_in?: number
}

type InterRequest = <T>(input: {
  baseUrl: string
  tokenUrl: string
  credentials: InterCredentials
  path: string
  method?: string
  scope?: string
  body?: unknown
  headers?: Record<string, string>
}) => Promise<T>

export type InterCharge = {
  codigoSolicitacao: string
  seuNumero?: string
  dataVencimento?: string
  valorNominal?: number | string
  situacao?: string
  valorTotalRecebido?: number | string | null
  origemRecebimento?: string | null
  boleto?: {
    linhaDigitavel?: string
  }
  pix?: {
    pixCopiaECola?: string
  }
  linhaDigitavel?: string
  pixCopiaECola?: string
}

type InterChargeListItem = InterCharge | {
  cobranca?: InterCharge
  boleto?: InterCharge['boleto']
  pix?: InterCharge['pix']
}

type InterChargeList = {
  cobrancas?: InterChargeListItem[]
  totalElementos?: number
  ultimaPagina?: boolean
  last?: boolean
}

type InterProblem = {
  title?: string
  detail?: string
  violacoes?: Array<{ razao?: string; propriedade?: string }>
}

const urls: Record<PaymentEnvironment, { baseUrl: string; tokenUrl: string }> = {
  sandbox: {
    baseUrl: 'https://cdpj-sandbox.partners.uatinter.co/cobranca/v3',
    tokenUrl: 'https://cdpj-sandbox.partners.uatinter.co/oauth/v2/token',
  },
  production: {
    baseUrl: 'https://cdpj.partners.bancointer.com.br/cobranca/v3',
    tokenUrl: 'https://cdpj.partners.bancointer.com.br/oauth/v2/token',
  },
}

function normalizePem(value: string) {
  return value.trim().replace(/\\n/g, '\n')
}

export function parseInterCredentials(value: string): InterCredentials {
  const parsed = JSON.parse(value) as Partial<InterCredentials>
  const credentials = {
    clientId: String(parsed.clientId || '').trim(),
    clientSecret: String(parsed.clientSecret || '').trim(),
    certificate: normalizePem(String(parsed.certificate || '')),
    privateKey: normalizePem(String(parsed.privateKey || '')),
    accountNumber: String(parsed.accountNumber || '').trim() || undefined,
  }
  if (!credentials.clientId || !credentials.clientSecret || !credentials.certificate || !credentials.privateKey) {
    throw new Error('Credenciais Inter incompletas.')
  }
  return credentials
}

export function serializeInterCredentials(input: InterCredentials) {
  return JSON.stringify({
    clientId: input.clientId.trim(),
    clientSecret: input.clientSecret.trim(),
    certificate: normalizePem(input.certificate),
    privateKey: normalizePem(input.privateKey),
    accountNumber: input.accountNumber?.trim() || undefined,
  })
}

function amount(value: unknown) {
  if (value === null || value === undefined || value === '') return '0.00'
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : '0.00'
}

export function mapInterStatus(status?: string): PaymentChargeStatus {
  switch (status) {
    case 'A_RECEBER':
    case 'EM_PROCESSAMENTO':
      return 'pending'
    case 'RECEBIDO':
    case 'MARCADO_RECEBIDO':
      return 'received'
    case 'ATRASADO':
      return 'overdue'
    case 'CANCELADO':
    case 'EXPIRADO':
      return 'cancelled'
    default:
      return status ? 'unknown' : 'pending'
  }
}

export function mapInterCharge(charge: InterCharge): PaymentCharge {
  const chargeAmount = amount(charge.valorNominal)
  const paidAmount = amount(charge.valorTotalRecebido)
  const pixPayload = charge.pix?.pixCopiaECola || charge.pixCopiaECola
  return {
    id: charge.codigoSolicitacao,
    customerId: '',
    amount: chargeAmount,
    dueDate: charge.dataVencimento || '',
    billingType: charge.origemRecebimento === 'PIX' ? 'PIX' : 'BOLETO',
    description: '',
    externalReference: charge.seuNumero || '',
    status: mapInterStatus(charge.situacao),
    bankSlipUrl: charge.boleto?.linhaDigitavel || charge.linhaDigitavel,
    paidAmount: Number(paidAmount) > 0 ? paidAmount : undefined,
    netAmount: Number(paidAmount) > 0 ? paidAmount : undefined,
    deleted: ['CANCELADO', 'EXPIRADO'].includes(charge.situacao || ''),
    paymentDate: Number(paidAmount) > 0 ? new Date().toISOString().slice(0, 10) : undefined,
    invoiceUrl: undefined,
    creditDate: undefined,
    ...(pixPayload ? { pixPayload } : {}),
  } as PaymentCharge & { pixPayload?: string }
}

function mapInterChargeListItem(item: InterChargeListItem) {
  if ('codigoSolicitacao' in item) {
    return mapInterCharge(item)
  }
  return mapInterCharge({
    ...item.cobranca,
    boleto: item.boleto ?? item.cobranca?.boleto,
    pix: item.pix ?? item.cobranca?.pix,
  } as InterCharge)
}

function parseInterCustomer(value: string) {
  try {
    const parsed = JSON.parse(value) as Partial<PaymentCustomer>
    return {
      cpfCnpj: String(parsed.cpfCnpj || value).replace(/\D/g, ''),
      name: String(parsed.name || 'Pagador'),
      email: parsed.email ? String(parsed.email) : undefined,
      address: parsed.address ? String(parsed.address) : '',
      addressNumber: parsed.addressNumber ? String(parsed.addressNumber) : '',
      addressComplement: parsed.addressComplement ? String(parsed.addressComplement) : '',
      neighborhood: parsed.neighborhood ? String(parsed.neighborhood) : '',
      city: parsed.city ? String(parsed.city) : '',
      state: parsed.state ? String(parsed.state).toUpperCase() : '',
      zipCode: parsed.zipCode ? String(parsed.zipCode).replace(/\D/g, '') : '',
    }
  } catch {
    return { cpfCnpj: value.replace(/\D/g, ''), name: 'Pagador', email: undefined, address: '', addressNumber: '', addressComplement: '', neighborhood: '', city: '', state: '', zipCode: '' }
  }
}

function validateInterPayer(customer: ReturnType<typeof parseInterCustomer>) {
  const missing = [
    ['address', customer.address],
    ['neighborhood', customer.neighborhood],
    ['city', customer.city],
    ['state', customer.state],
    ['zipCode', customer.zipCode],
  ].filter(([, value]) => !String(value || '').trim()).map(([field]) => field)

  if (missing.length > 0) {
    throw new Error(`Para emitir boleto pelo Inter, complete o endereco do cliente: ${missing.join(', ')}.`)
  }
  if (!/^\d{8}$/.test(customer.zipCode)) {
    throw new Error('Para emitir boleto pelo Inter, informe o CEP do cliente com 8 digitos.')
  }
  if (!/^[A-Z]{2}$/.test(customer.state)) {
    throw new Error('Para emitir boleto pelo Inter, informe a UF do cliente com 2 letras.')
  }
}

function maskDocument(value?: string) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length <= 4) return digits ? '****' : ''
  return `${digits.slice(0, 3)}***${digits.slice(-2)}`
}

function shouldLogPaymentPayloads() {
  return process.env.PAYMENT_DEBUG_LOG_PAYLOADS === 'true'
}

function sanitizeInterPayload(body: unknown) {
  if (!body || typeof body !== 'object') return body
  const payload = body as Record<string, unknown>
  const payer = payload.pagador && typeof payload.pagador === 'object'
    ? payload.pagador as Record<string, unknown>
    : null

  return {
    ...payload,
    pagador: payer
      ? {
          ...payer,
          cpfCnpj: maskDocument(String(payer.cpfCnpj || '')),
          nome: payer.nome ? '[informado]' : '',
          email: payer.email ? '[informado]' : undefined,
          endereco: payer.endereco ? '[informado]' : undefined,
          bairro: payer.bairro ? '[informado]' : undefined,
          cidade: payer.cidade ? '[informado]' : undefined,
          cep: payer.cep ? maskDocument(String(payer.cep || '')) : undefined,
        }
      : payload.pagador,
  }
}

function responseStatusText(statusMessage: string | undefined, responseText: string) {
  if (responseText && responseText.length < 500) return responseText
  return statusMessage || 'erro desconhecido'
}

function sanitizeInterPath(path: string) {
  return path.replace(/(cpfCnpjPessoaPagadora=)[^&]+/g, '$1[mascarado]')
}

async function httpsJsonRequest<T>(url: string, options: {
  method?: string
  cert: string
  key: string
  headers?: Record<string, string>
  body?: string
}): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: options.method ?? 'GET',
      cert: options.cert,
      key: options.key,
      headers: options.headers,
    }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let body: T | InterProblem | null = null
        try {
          body = text ? JSON.parse(text) as T | InterProblem : null
        } catch {
          body = null
        }
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
          resolve(body as T)
          return
        }
        const problem = body as InterProblem | null
        const violations = problem?.violacoes
          ?.map((item) => [item.propriedade, item.razao].filter(Boolean).join(': '))
          .filter(Boolean)
          .join('; ')
        reject(new Error(`Inter ${response.statusCode}: ${problem?.detail || problem?.title || violations || responseStatusText(response.statusMessage, text)}`))
      })
    })
    request.on('error', reject)
    if (options.body) request.write(options.body)
    request.end()
  })
}

async function defaultInterRequest<T>(input: Parameters<InterRequest>[0]): Promise<T> {
  const tokenBody = new URLSearchParams({
    client_id: input.credentials.clientId,
    client_secret: input.credentials.clientSecret,
    grant_type: 'client_credentials',
    scope: input.scope || 'boleto-cobranca.read boleto-cobranca.write',
  })
  const token = await httpsJsonRequest<InterToken>(input.tokenUrl, {
    method: 'POST',
    cert: input.credentials.certificate,
    key: input.credentials.privateKey,
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
      'content-length': String(Buffer.byteLength(tokenBody.toString())),
    },
    body: tokenBody.toString(),
  })

  const body = input.body === undefined ? undefined : JSON.stringify(input.body)
  if (shouldLogPaymentPayloads() && input.path.startsWith('/cobrancas')) {
    console.info('payment_inter_request', {
      safePath: sanitizeInterPath(input.path),
      method: input.method,
      scope: input.scope,
      payload: sanitizeInterPayload(input.body),
    })
  }
  return httpsJsonRequest<T>(`${input.baseUrl}${input.path}`, {
    method: input.method,
    cert: input.credentials.certificate,
    key: input.credentials.privateKey,
    headers: {
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(body)) } : {}),
      authorization: `Bearer ${token.access_token}`,
      ...(input.credentials.accountNumber ? { 'x-conta-corrente': input.credentials.accountNumber } : {}),
      ...input.headers,
    },
    body,
  })
}

function datePlusDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00.000Z`)
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}

export class InterPaymentProvider implements PaymentProvider {
  readonly name = 'inter' as const
  private readonly baseUrl: string
  private readonly tokenUrl: string

  constructor(
    private readonly credentials: InterCredentials,
    environment: PaymentEnvironment = 'sandbox',
    private readonly requester: InterRequest = defaultInterRequest,
  ) {
    const selected = urls[environment]
    this.baseUrl = selected.baseUrl
    this.tokenUrl = selected.tokenUrl
  }

  private request<T>(path: string, init: Omit<Parameters<InterRequest>[0], 'baseUrl' | 'tokenUrl' | 'credentials' | 'path'> = {}) {
    return this.requester<T>({
      baseUrl: this.baseUrl,
      tokenUrl: this.tokenUrl,
      credentials: this.credentials,
      path,
      ...init,
    })
  }

  async createCustomer(input: PaymentCustomerInput): Promise<PaymentCustomer> {
    return {
      ...input,
      id: JSON.stringify({
        cpfCnpj: input.cpfCnpj,
        name: input.name,
        email: input.email,
        address: input.address,
        addressNumber: input.addressNumber,
        addressComplement: input.addressComplement,
        neighborhood: input.neighborhood,
        city: input.city,
        state: input.state,
        zipCode: input.zipCode,
      }),
    }
  }

  async findCustomerByDocument(cpfCnpj: string): Promise<PaymentCustomer | null> {
    return null
  }

  async createCharge(input: PaymentChargeInput): Promise<PaymentCharge> {
    const customer = parseInterCustomer(input.customerId)
    validateInterPayer(customer)
    const response = await this.request<{ codigoSolicitacao: string }>('/cobrancas', {
      method: 'POST',
      scope: 'boleto-cobranca.write',
      body: {
        seuNumero: input.externalReference,
        valorNominal: Number(input.amount),
        dataVencimento: input.dueDate,
        numDiasAgenda: 60,
        pagador: {
          cpfCnpj: customer.cpfCnpj,
          tipoPessoa: customer.cpfCnpj.length > 11 ? 'JURIDICA' : 'FISICA',
          nome: customer.name,
          email: customer.email,
          endereco: customer.address,
          numero: customer.addressNumber || undefined,
          complemento: customer.addressComplement || undefined,
          bairro: customer.neighborhood,
          cidade: customer.city,
          uf: customer.state,
          cep: customer.zipCode,
        },
        multa: input.fine ? { taxa: Number(input.fine.percentage), codigo: 'PERCENTUAL' } : undefined,
        mora: input.interest ? { taxa: Number(input.interest.percentage), codigo: 'TAXAMENSAL' } : undefined,
        mensagem: { linha1: input.description },
        formasRecebimento: ['BOLETO', 'PIX'],
      },
    })
    return {
      ...input,
      id: response.codigoSolicitacao,
      status: 'pending',
    }
  }

  async updateCharge(chargeId: string, input: PaymentChargeUpdateInput): Promise<PaymentCharge> {
    await this.request<{ codigoEdicao?: string }>(`/cobrancas/${encodeURIComponent(chargeId)}`, {
      method: 'PATCH',
      scope: 'boleto-cobranca.write',
      body: {
        dataVencimento: input.dueDate,
        valorNominal: Number(input.amount),
      },
    })
    return this.getCharge(chargeId)
  }

  async getCharge(chargeId: string): Promise<PaymentCharge> {
    return mapInterCharge(await this.request<InterCharge>(`/cobrancas/${encodeURIComponent(chargeId)}`, {
      scope: 'boleto-cobranca.read',
    }))
  }

  async listCharges(filter: ListChargesFilter = {}): Promise<ListChargesResult> {
    const today = new Date()
    const initialDate = filter.externalReference ? '2000-01-01' : datePlusDays(today.toISOString().slice(0, 10), -30)
    const finalDate = filter.externalReference ? '2100-12-31' : datePlusDays(today.toISOString().slice(0, 10), 30)
    const query = new URLSearchParams({
      dataInicial: initialDate,
      dataFinal: finalDate,
      'paginacao.itensPorPagina': String(filter.limit ?? 20),
      'paginacao.paginaAtual': String(filter.offset ?? 0),
    })
    if (filter.externalReference) query.set('seuNumero', filter.externalReference)
    if (filter.customerId) query.set('cpfCnpjPessoaPagadora', filter.customerId)
    const result = await this.request<InterChargeList>(`/cobrancas?${query}`, {
      scope: 'boleto-cobranca.read',
    })
    return {
      charges: (result.cobrancas ?? []).map(mapInterChargeListItem),
      totalCount: result.totalElementos ?? result.cobrancas?.length ?? 0,
      hasMore: result.ultimaPagina === false || result.last === false,
    }
  }

  async cancelCharge(chargeId: string): Promise<PaymentCharge> {
    await this.request(`/cobrancas/${encodeURIComponent(chargeId)}/cancelar`, {
      method: 'POST',
      scope: 'boleto-cobranca.write',
      body: { motivoCancelamento: 'ACERTOS' },
    })
    return { ...(await this.getCharge(chargeId)), status: 'cancelled', deleted: true }
  }

  async getPixQrCode(chargeId: string): Promise<PixQrCode> {
    const charge = await this.getCharge(chargeId) as PaymentCharge & { pixPayload?: string }
    if (!charge.pixPayload) throw new Error('QR Code Pix ainda nao disponivel para esta cobranca Inter.')
    return { payload: charge.pixPayload, encodedImage: '' }
  }

  async getChargePdfBase64(chargeId: string): Promise<string> {
    const response = await this.request<{ pdf: string }>(`/cobrancas/${encodeURIComponent(chargeId)}/pdf`, {
      scope: 'boleto-cobranca.read',
    })
    if (!response.pdf) throw new Error('PDF da cobranca Inter nao retornado.')
    return response.pdf
  }

  async ensurePaymentWebhook(input: { url: string }): Promise<PaymentWebhookConfig> {
    await this.request('/cobrancas/webhook', {
      method: 'PUT',
      scope: 'boleto-cobranca.write',
      body: { webhookUrl: input.url },
    })
    return {
      id: input.url,
      name: 'Inter Cobrança',
      url: input.url,
      enabled: true,
      interrupted: false,
    }
  }
}
