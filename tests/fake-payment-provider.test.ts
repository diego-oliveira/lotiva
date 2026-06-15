import assert from 'node:assert/strict'
import test from 'node:test'
import { FakePaymentProvider } from '../lib/payments/fake-provider'

test('reutiliza cliente e cobranca por referencia externa', async () => {
  const provider = new FakePaymentProvider()
  const customerInput = {
    name: 'Cliente Teste',
    cpfCnpj: '12345678900',
    externalReference: 'user-1',
  }
  const customer = await provider.createCustomer(customerInput)
  const sameCustomer = await provider.createCustomer(customerInput)
  assert.equal(sameCustomer.id, customer.id)

  const chargeInput = {
    customerId: customer.id,
    amount: '600.00',
    dueDate: '2026-07-20',
    billingType: 'BOLETO' as const,
    description: 'Parcela 1',
    externalReference: 'receivable-1',
  }
  const charge = await provider.createCharge(chargeInput)
  const sameCharge = await provider.createCharge(chargeInput)
  assert.equal(sameCharge.id, charge.id)
  assert.equal((await provider.listCharges()).totalCount, 1)
})

test('cancela cobranca e mantem estado consultavel', async () => {
  const provider = new FakePaymentProvider()
  const customer = await provider.createCustomer({
    name: 'Cliente Teste',
    cpfCnpj: '12345678900',
    externalReference: 'user-1',
  })
  const charge = await provider.createCharge({
    customerId: customer.id,
    amount: '600.00',
    dueDate: '2026-07-20',
    billingType: 'BOLETO',
    description: 'Parcela 1',
    externalReference: 'receivable-1',
  })

  const cancelled = await provider.cancelCharge(charge.id)
  assert.equal(cancelled.status, 'cancelled')
  assert.equal(cancelled.deleted, true)
  assert.equal((await provider.getCharge(charge.id)).status, 'cancelled')
})
