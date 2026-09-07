import assert from 'node:assert/strict'
import test from 'node:test'
import { buildChargeExternalReference, selectNextCycleReceivables } from '../lib/payments/billing-cycle'

function receivable(sequence: number) {
  return {
    id: `rec-${sequence}`,
    sequence,
    dueDate: new Date(Date.UTC(2026, sequence - 1, 20)),
    amount: { toString: () => '600.00' },
    marker: `item-${sequence}`,
  }
}

test('seleciona no maximo 12 parcelas em ordem', () => {
  const selected = selectNextCycleReceivables(
    Array.from({ length: 15 }, (_, index) => receivable(15 - index)),
  )

  assert.equal(selected.length, 12)
  assert.deepEqual(selected.map((item) => item.sequence), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  assert.equal(selected[0].marker, 'item-1')
})

test('aceita ciclo menor e rejeita tamanho acima de 12', () => {
  assert.equal(selectNextCycleReceivables([receivable(1), receivable(2)], 1).length, 1)
  assert.throws(
    () => selectNextCycleReceivables([receivable(1)], 13),
    /entre 1 e 12/,
  )
})

test('usa seuNumero curto para cobrancas Inter', () => {
  const receivableId = '1e027f15-e578-4bf8-866c-01cf731e6006'
  const interReference = buildChargeExternalReference(receivableId, 'inter')

  assert.equal(interReference.length, 15)
  assert.match(interReference, /^r[0-9a-f]{14}$/)
  assert.equal(buildChargeExternalReference(receivableId, 'asaas'), `receivable:${receivableId}:v1`)
})
