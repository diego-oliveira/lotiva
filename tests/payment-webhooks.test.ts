import assert from 'node:assert/strict'
import test from 'node:test'
import { mapAsaasWebhookCharge } from '../lib/payments/webhooks'

const payment = {
  id: 'pay_123',
  customer: 'cus_123',
  value: 600,
  netValue: 597.01,
  dueDate: '2026-07-20',
  billingType: 'BOLETO' as const,
  externalReference: 'receivable:123:v1',
  status: 'PENDING',
}

test('evento recebido prevalece sobre o status contido no pagamento', () => {
  const charge = mapAsaasWebhookCharge({
    id: 'evt_1',
    event: 'PAYMENT_RECEIVED',
    payment,
  })

  assert.equal(charge?.status, 'received')
  assert.equal(charge?.paidAmount, undefined)
  assert.equal(charge?.netAmount, '597.01')
})

test('mapeia exclusao, restauracao, vencimento e estorno', () => {
  assert.equal(mapAsaasWebhookCharge({ id: '1', event: 'PAYMENT_DELETED', payment })?.status, 'cancelled')
  assert.equal(mapAsaasWebhookCharge({ id: '2', event: 'PAYMENT_RESTORED', payment })?.status, 'pending')
  assert.equal(mapAsaasWebhookCharge({ id: '3', event: 'PAYMENT_OVERDUE', payment })?.status, 'overdue')
  assert.equal(mapAsaasWebhookCharge({ id: '4', event: 'PAYMENT_REFUNDED', payment })?.status, 'refunded')
})
