import assert from 'node:assert/strict'
import test from 'node:test'
import { Prisma } from '../app/generated/prisma'
import { calculateSettlement, participants, normalizeSnapshot, participantSummaries, validatePaidAllocations, type DistributionParticipant } from '../lib/partner-settlements'
import { snapshotToken } from '../lib/partner-settlement-data'

const people: DistributionParticipant[] = [
  { id: 'ana', kind: 'person', name: 'Ana', percentage: 20, pixKey: '' },
  { id: 'empresa', kind: 'company', name: 'Investimentos Ltda', percentage: 30, pixKey: '' },
]
const base = {
  developmentName: 'Empreendimento', month: '2026-09', participants: people,
  receipts: [{ id: 'r1', saleId: 's1', description: 'Cliente', paidAt: '2026-09-10', amount: 20000 }],
  commissions: [{ id: 'c1', saleId: 's1', description: 'Corretor', paidAt: '2026-09-12', amount: 2000 }],
  expenses: [{ description: 'Campanha', category: 'Marketing', amount: 1000, paidAt: '2026-09-20', proofUrl: '' }], adjustments: [],
}

test('distribui o liquido entre pessoas e empresas e identifica o saldo da operacao', () => {
  const snapshot = calculateSettlement(base)
  assert.equal(snapshot.netAmount, 17000)
  assert.deepEqual(snapshot.participants.map((item) => item.amount), [3400, 5100])
  assert.equal(snapshot.partnerAmount, 8500)
  assert.equal(snapshot.operationAmount, 8500)
  assert.equal(snapshot.totalPercentage, 50)
  assert.equal(snapshot.expenses[0].category, 'Marketing')
})

test('regras rejeitam percentual acima de 100, identidade duplicada ou tipo invalido', () => {
  assert.throws(() => participants(people.map((item) => ({ ...item, percentage: 50.0001 }))), /100%/)
  assert.throws(() => participants([people[0], people[0]]), /identificador/)
  assert.throws(() => participants([{ ...people[0], kind: 'invalid' }]))
  assert.throws(() => participants([{ ...people[0], percentage: 0.0000001 }]))
  assert.throws(() => participants([]))
  assert.equal(participants(people.map((item) => ({ ...item, percentage: 50 }))).length, 2)
})

test('divisao de um centavo a 100% nao cria dinheiro e e estavel por identidade', () => {
  const input = { ...base, receipts: [{ ...base.receipts[0], amount: 0.01 }], commissions: [], expenses: [], participants: people.map((item) => ({ ...item, percentage: 50 })) }
  const result = calculateSettlement(input)
  assert.equal(result.partnerAmount, 0.01)
  assert.equal(result.operationAmount, 0)
  assert.deepEqual(result.participants.map((item) => item.amount), [0.01, 0])
  const reversed = calculateSettlement({ ...input, participants: [...input.participants].reverse() })
  assert.deepEqual(Object.fromEntries(reversed.participants.map((item) => [item.id, item.amount])), Object.fromEntries(result.participants.map((item) => [item.id, item.amount])))
})

test('valores distribuidos conservam os centavos do liquido em varios tamanhos de divisao', () => {
  for (const cents of [1, 2, 3, 7, 11, 99, 100, 101, 99999]) {
    for (const count of [2, 3, 7, 10]) {
      const snapshot = calculateSettlement({ ...base, commissions: [], expenses: [], receipts: [{ ...base.receipts[0], amount: cents / 100 }], participants: Array.from({ length: count }, (_, index) => ({ id: `p${index}`, name: `Participante ${index}`, kind: 'person', percentage: Math.floor(1000000 / count) / 10000, pixKey: '' })) })
      const sum = snapshot.participants.reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0))
      assert.equal(sum.plus(snapshot.operationAmount).toNumber(), snapshot.netAmount)
      assert.ok(sum.lte(snapshot.netAmount))
      assert.ok(snapshot.participants.every((item) => item.amount >= 0))
    }
  }
})

test('pagamentos sao separados por participante, sem consumir saldo de outra pessoa', () => {
  const snapshot = calculateSettlement(base)
  const payments = [{ participantId: 'ana', amount: 1000 }]
  const summary = participantSummaries(snapshot, payments)
  assert.equal(summary[0].remaining, 2400)
  assert.equal(summary[1].remaining, 5100)
  assert.throws(() => validatePaidAllocations(snapshot, [{ participantId: 'ana', amount: 3400.01 }]))
  assert.throws(() => validatePaidAllocations(snapshot, [{ participantId: 'outro', amount: 1 }]))
  assert.doesNotThrow(() => validatePaidAllocations(snapshot, payments))
})

test('fechamento negativo preserva o resultado sem gerar divida negativa por participante', () => {
  const snapshot = calculateSettlement({ ...base, receipts: [] })
  assert.equal(snapshot.netAmount, -3000)
  assert.equal(snapshot.operationAmount, -3000)
  assert.ok(snapshot.participants.every((item) => item.amount === 0))
})

test('adapta um demonstrativo antigo sem regravar ou recalcular valores confirmados', () => {
  const legacy = { ...base, participants: undefined, partnerName: 'Terrenista', percentage: 50, pixKey: 'chave', receiptsTotal: 20000, commissionsTotal: 2000, costsTotal: 1000, adjustmentsTotal: 0, netAmount: 17000, partnerAmount: 8500 }
  const original = JSON.stringify(legacy)
  const snapshot = normalizeSnapshot(legacy)
  assert.equal(snapshot.participants[0].id, 'legacy')
  assert.equal(snapshot.participants[0].name, 'Terrenista')
  assert.equal(snapshot.participants[0].amount, 8500)
  assert.equal(snapshot.operationAmount, 8500)
  assert.equal(JSON.stringify(legacy), original)
  assert.equal(participantSummaries(snapshot, [{ amount: 1000 }])[0].remaining, 7500)
  const live = calculateSettlement({ ...base, participants: [{ id: 'legacy', kind: 'person', name: 'Terrenista', percentage: 50, pixKey: 'chave' }] })
  assert.equal(snapshotToken(snapshot), snapshotToken(live))
})
