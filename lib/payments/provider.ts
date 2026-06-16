import type {
  ListChargesFilter,
  ListChargesResult,
  PaymentCharge,
  PaymentChargeInput,
  PaymentChargeUpdateInput,
  PaymentCustomer,
  PaymentCustomerInput,
  PaymentProviderName,
  PixQrCode,
} from './types'

export interface PaymentProvider {
  readonly name: PaymentProviderName

  createCustomer(input: PaymentCustomerInput): Promise<PaymentCustomer>
  findCustomerByDocument(cpfCnpj: string): Promise<PaymentCustomer | null>
  createCharge(input: PaymentChargeInput): Promise<PaymentCharge>
  updateCharge(chargeId: string, input: PaymentChargeUpdateInput): Promise<PaymentCharge>
  getCharge(chargeId: string): Promise<PaymentCharge>
  listCharges(filter?: ListChargesFilter): Promise<ListChargesResult>
  cancelCharge(chargeId: string): Promise<PaymentCharge>
  getPixQrCode(chargeId: string): Promise<PixQrCode>
}
