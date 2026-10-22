import assert from 'node:assert/strict'
import test from 'node:test'
import { financeSearchFilter } from '../lib/finance-search'

test('busca por email ou nome nao inclui CPF vazio que retornaria todos os clientes', () => {
  for (const term of ['cliente@example.com', 'Maria Silva']) {
    const filter = financeSearchFilter(term)
    const conditions = filter.OR ?? []
    assert.ok(conditions.length > 0)
    assert.ok(!JSON.stringify(filter).includes('"cpf"'))
    assert.ok(JSON.stringify(filter).includes(term))
    assert.ok(!JSON.stringify(filter).includes('"contains":""'))
  }
})

test('busca por CPF formatado usa somente os digitos na comparacao de CPF', () => {
  const filter = financeSearchFilter('123.456.789-00')
  assert.ok(JSON.stringify(filter).includes('"cpf":{"contains":"12345678900"}'))
})

test('busca vazia nao restringe os resultados', () => {
  assert.deepEqual(financeSearchFilter('   '), {})
})
