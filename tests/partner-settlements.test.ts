import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateSettlement, paymentSummary, monthPeriod, validDate, recurringCosts, expenses, adjustments, percentage, amount, proofUrl } from '../lib/partner-settlements'
import { snapshotToken } from '../lib/partner-settlement-data'

const base = {
  developmentName: 'Empreendimento', partnerName: 'Sócio', percentage: 50, pixKey: '', month: '2026-09',
  receipts: [{ id: 'r1', saleId: 's1', description: 'Cliente', paidAt: '2026-09-10', amount: 20_000 }],
  commissions: [{ id: 'c1', saleId: 's1', description: 'Corretor', paidAt: '2026-09-12', amount: 2_000 }],
  expenses: [{ description: 'Sistema', amount: 250, paidAt: '2026-09-30', proofUrl: '' }, { description: 'Outros', amount: 750, paidAt: '2026-09-10', proofUrl: '' }],
  adjustments: [],
}

test('assinatura do demonstrativo ignora ordem de chaves JSONB e detecta alteracao real', () => {
  const snapshot = calculateSettlement(base)
  const reordered = JSON.parse(JSON.stringify(snapshot), (_, value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).reverse()) : value)
  assert.equal(snapshotToken(snapshot), snapshotToken(reordered))
  assert.notEqual(snapshotToken(snapshot), snapshotToken({ ...snapshot, netAmount: 100 }))
})

test('divide o recebido menos comissoes e custos pelo percentual do socio', () => {
  const result = calculateSettlement(base)
  assert.equal(result.receiptsTotal, 20_000)
  assert.equal(result.commissionsTotal, 2_000)
  assert.equal(result.costsTotal, 1_000)
  assert.equal(result.netAmount, 17_000)
  assert.equal(result.partnerAmount, 8_500)
})

test('arredonda centavos e aplica ajustes na base antes da participacao', () => {
  const result = calculateSettlement({ ...base, percentage: 33.3333, adjustments: [{ description: 'Correção', amount: -100.01, referenceMonth: '2026-08' }] })
  assert.equal(result.netAmount, 16_899.99)
  assert.equal(result.partnerAmount, 5633.32)
  assert.equal(calculateSettlement({ ...base, expenses: [], commissions: [], receipts: [{ ...base.receipts[0], amount: 0.03 }] }).partnerAmount, 0.02)
})

test('resultado negativo fica no demonstrativo sem gerar repasse negativo', () => {
  const result = calculateSettlement({ ...base, receipts: [] })
  assert.equal(result.netAmount, -3000)
  assert.equal(result.partnerAmount, 0)
})

test('acompanha Pix parcial e saldo em centavos sem duplicar status de fechamento', () => {
  assert.deepEqual(paymentSummary(8500, []), { paid: 0, remaining: 8500, status: 'pending' })
  assert.deepEqual(paymentSummary(8500, [{ amount: 3000 }]), { paid: 3000, remaining: 5500, status: 'partial' })
  assert.deepEqual(paymentSummary(0.3, [{ amount: 0.1 }, { amount: 0.2 }]), { paid: 0.3, remaining: 0, status: 'paid' })
})

test('delimita meses em Bahia com fim exclusivo, inclusive fevereiro bissexto e dezembro', () => {
  assert.equal(monthPeriod('2026-09').start.toISOString(), '2026-09-01T03:00:00.000Z')
  assert.equal(monthPeriod('2026-09').end.toISOString(), '2026-10-01T03:00:00.000Z')
  assert.equal(monthPeriod('2024-02').lastDate, '2024-02-29')
  assert.equal(monthPeriod('2026-12').end.toISOString(), '2027-01-01T03:00:00.000Z')
  for (const invalid of ['2026-13', '2026-2', '1999-12', 'x']) assert.throws(() => monthPeriod(invalid))
  assert.throws(() => validDate('2026-02-30'))
})

test('valida despesas, valores e participacao no servidor', () => {
  assert.equal(percentage('50'), 50)
  for (const invalid of [0, 101, null, '', Infinity, 'x']) assert.throws(() => percentage(invalid))
  for (const invalid of [0, -1, null, '', Infinity, 'x']) assert.throws(() => amount(invalid))
  assert.throws(() => recurringCosts([{ description: '', amount: 250 }]))
  assert.throws(() => expenses([{ description: 'Sistema', amount: 250, paidAt: '2026-10-01' }], '2026-09', 'dev'))
  assert.throws(() => adjustments([{ description: 'Correção', amount: -10, referenceMonth: '2026-09' }], '2026-09'))
  assert.equal(adjustments([{ description: 'Correção', amount: -10, referenceMonth: '2026-08' }], '2026-09')[0].amount, -10)
})

test('comprovantes sao privados e vinculados ao mesmo empreendimento', () => {
  const url = '/api/partner-settlements/proofs?developmentId=dev&file=12345678-1234-1234-1234-123456789abc.pdf'
  assert.equal(proofUrl(url, 'dev'), url)
  assert.throws(() => proofUrl(url, 'outro'))
  assert.throws(() => proofUrl('javascript:alert(1)', 'dev'))
  assert.throws(() => proofUrl('/uploads/teste.pdf', 'dev'))
})
