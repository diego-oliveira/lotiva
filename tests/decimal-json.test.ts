import assert from 'node:assert/strict'
import test from 'node:test'
import { Prisma } from '../app/generated/prisma'
import '../lib/prisma'

test('serializa Decimal como numero para preservar o contrato das APIs', () => {
  assert.equal(JSON.stringify({ amount: new Prisma.Decimal('600.50') }), '{"amount":600.5}')
})
