export type PaymentProviderName = 'asaas' | 'fake'
export type PaymentEnvironment = 'sandbox' | 'production'
export type BillingType = 'BOLETO' | 'PIX' | 'UNDEFINED'

export type PaymentCustomerInput = {
  name: string
  cpfCnpj: string
  email?: string
  mobilePhone?: string
  externalReference: string
  notificationDisabled?: boolean
}

export type PaymentCustomer = PaymentCustomerInput & {
  id: string
}

export type LateFeeRule = {
  percentage: string
}

export type PaymentChargeInput = {
  customerId: string
  amount: string
  dueDate: string
  billingType: BillingType
  description: string
  externalReference: string
  interest?: LateFeeRule
  fine?: LateFeeRule
}

export type PaymentChargeStatus =
  | 'pending'
  | 'confirmed'
  | 'received'
  | 'overdue'
  | 'refunded'
  | 'cancelled'
  | 'unknown'

export type PaymentCharge = PaymentChargeInput & {
  id: string
  status: PaymentChargeStatus
  invoiceUrl?: string
  bankSlipUrl?: string
  deleted?: boolean
  paidAmount?: string
  netAmount?: string
  paymentDate?: string
  creditDate?: string
}

export type PaymentChargeUpdateInput = Omit<PaymentChargeInput, 'customerId'>

export type PixQrCode = {
  encodedImage: string
  payload: string
  expirationDate?: string
}

export type ListChargesFilter = {
  customerId?: string
  externalReference?: string
  status?: PaymentChargeStatus
  offset?: number
  limit?: number
}

export type ListChargesResult = {
  charges: PaymentCharge[]
  hasMore: boolean
  totalCount: number
}

export type PaymentWebhookConfig = {
  id: string
  name: string
  url: string
  enabled: boolean
  interrupted: boolean
}
