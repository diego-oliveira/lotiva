import assert from 'node:assert/strict'
import test from 'node:test'
import { parsePaymentDate, bahiaDate } from '../lib/payment-dates'

test('data de pagamento preserva o dia em Bahia e usa meio-dia local', () => {
  assert.equal(parsePaymentDate('2026-09-21').toISOString(), '2026-09-21T15:00:00.000Z')
  assert.equal(bahiaDate(new Date('2026-10-01T02:59:59Z')), '2026-09-30')
  assert.equal(bahiaDate(new Date('2026-10-01T03:00:00Z')), '2026-10-01')
})

test('rejeita datas inexistentes e entradas que nao sejam uma data de calendario', () => {
  for (const input of ['2026-02-30', '2026-02-29', '2026-13-01', '2026-01-00', '2026-01-01T12:00:00Z', '', null, 123]) assert.throws(() => parsePaymentDate(input))
  assert.equal(parsePaymentDate('2024-02-29').toISOString().slice(0, 10), '2024-02-29')
})
