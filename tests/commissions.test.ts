import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateCommissionAvailability, commissionAmount } from '../lib/commissions'

test('calcula a comissao pelo percentual da venda', () => {
  assert.equal(commissionAmount(100_000, 6), 6_000)
  assert.equal(commissionAmount(88_850, 4), 3_554)
})

test('libera a comissao proporcionalmente ao pagamento da entrada', () => {
  assert.deepEqual(
    calculateCommissionAvailability(6_000, 0, { entryPaidRatio: 1 / 3 }),
    { releasedAmount: 2_000, availableAmount: 2_000 },
  )
  assert.deepEqual(
    calculateCommissionAvailability(6_000, 2_000, { entryPaidRatio: 2 / 3 }),
    { releasedAmount: 4_000, availableAmount: 2_000 },
  )
})

test('nunca libera acima da comissao total nem saldo negativo', () => {
  assert.deepEqual(
    calculateCommissionAvailability(6_000, 6_000, { entryPaidRatio: 1 }),
    { releasedAmount: 6_000, availableAmount: 0 },
  )
})
