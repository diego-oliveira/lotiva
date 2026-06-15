import assert from 'node:assert/strict'
import test from 'node:test'
import { addMoney, decimal, multiplyMoney, subtractMoney } from '../lib/money'

test('normaliza valores monetarios para duas casas decimais', () => {
  assert.equal(decimal('10.005').toFixed(2), '10.01')
  assert.equal(decimal('10.004').toFixed(2), '10.00')
})

test('soma valores sem erro de ponto flutuante', () => {
  assert.equal(addMoney('0.10', '0.20').toFixed(2), '0.30')
})

test('subtrai e multiplica valores com arredondamento monetario', () => {
  assert.equal(subtractMoney('100.00', '10.01').toFixed(2), '89.99')
  assert.equal(multiplyMoney('33.335', 3).toFixed(2), '100.02')
})
