import type { PaymentProvider } from './provider'
import type {
  ListChargesFilter,
  ListChargesResult,
  PaymentCharge,
  PaymentChargeInput,
  PaymentChargeUpdateInput,
  PaymentCustomer,
  PaymentCustomerInput,
  PixQrCode,
} from './types'

export class FakePaymentProvider implements PaymentProvider {
  readonly name = 'fake' as const
  private customerSequence = 0
  private chargeSequence = 0
  private readonly customers = new Map<string, PaymentCustomer>()
  private readonly charges = new Map<string, PaymentCharge>()

  async createCustomer(input: PaymentCustomerInput) {
    const existing = await this.findCustomerByDocument(input.cpfCnpj)
    if (existing) return existing

    const customer = {
      ...input,
      id: `cus_fake_${++this.customerSequence}`,
    }
    this.customers.set(customer.id, customer)
    return customer
  }

  async findCustomerByDocument(cpfCnpj: string) {
    return [...this.customers.values()].find((customer) => customer.cpfCnpj === cpfCnpj) ?? null
  }

  async createCharge(input: PaymentChargeInput) {
    const existing = [...this.charges.values()]
      .find((charge) => charge.externalReference === input.externalReference && !charge.deleted)
    if (existing) return existing

    const charge: PaymentCharge = {
      ...input,
      id: `pay_fake_${++this.chargeSequence}`,
      status: 'pending',
      invoiceUrl: `https://example.test/invoice/${this.chargeSequence}`,
      bankSlipUrl: `https://example.test/boleto/${this.chargeSequence}`,
    }
    this.charges.set(charge.id, charge)
    return charge
  }

  async updateCharge(chargeId: string, input: PaymentChargeUpdateInput) {
    const current = await this.getCharge(chargeId)
    const updated = { ...current, ...input, id: current.id }
    this.charges.set(chargeId, updated)
    return updated
  }

  async getCharge(chargeId: string) {
    const charge = this.charges.get(chargeId)
    if (!charge) throw new Error(`Cobranca nao encontrada: ${chargeId}`)
    return charge
  }

  async listCharges(filter: ListChargesFilter = {}): Promise<ListChargesResult> {
    const charges = [...this.charges.values()].filter((charge) => (
      (!filter.customerId || charge.customerId === filter.customerId) &&
      (!filter.externalReference || charge.externalReference === filter.externalReference) &&
      (!filter.status || charge.status === filter.status)
    ))
    const offset = filter.offset ?? 0
    const limit = filter.limit ?? charges.length

    return {
      charges: charges.slice(offset, offset + limit),
      hasMore: offset + limit < charges.length,
      totalCount: charges.length,
    }
  }

  async cancelCharge(chargeId: string) {
    const charge = await this.getCharge(chargeId)
    const cancelled: PaymentCharge = {
      ...charge,
      status: 'cancelled',
      deleted: true,
    }
    this.charges.set(chargeId, cancelled)
    return cancelled
  }

  async getPixQrCode(chargeId: string): Promise<PixQrCode> {
    await this.getCharge(chargeId)
    return {
      encodedImage: 'ZmFrZS1waXg=',
      payload: `000201-fake-${chargeId}`,
    }
  }
}
