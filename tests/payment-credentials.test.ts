import assert from 'node:assert/strict'
import test from 'node:test'
import { randomBytes } from 'crypto'
import {
  decryptPaymentCredential,
  encryptPaymentCredential,
} from '../lib/payments/credentials'

test('criptografa e descriptografa credenciais sem expor o valor original', () => {
  const previous = process.env.PAYMENT_CREDENTIALS_KEY
  process.env.PAYMENT_CREDENTIALS_KEY = randomBytes(32).toString('base64')

  try {
    const value = '$aact_hmlg_secret'
    const encrypted = encryptPaymentCredential(value)
    assert.equal(encrypted.includes(value), false)
    assert.equal(decryptPaymentCredential(encrypted), value)
  } finally {
    if (previous === undefined) delete process.env.PAYMENT_CREDENTIALS_KEY
    else process.env.PAYMENT_CREDENTIALS_KEY = previous
  }
})

test('rejeita chave de criptografia com tamanho invalido', () => {
  const previous = process.env.PAYMENT_CREDENTIALS_KEY
  process.env.PAYMENT_CREDENTIALS_KEY = Buffer.from('curta').toString('base64')

  try {
    assert.throws(
      () => encryptPaymentCredential('secret'),
      /32 bytes/,
    )
  } finally {
    if (previous === undefined) delete process.env.PAYMENT_CREDENTIALS_KEY
    else process.env.PAYMENT_CREDENTIALS_KEY = previous
  }
})
