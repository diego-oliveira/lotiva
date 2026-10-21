import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveAutentiqueStatus, getAutentiqueEnvironment, mergeAutentiqueSignerStatus, type AutentiqueSignerInput } from '../lib/autentique'

const configured: AutentiqueSignerInput[] = [
  { name: 'Comprador', email: 'buyer@example.com', action: 'SIGN', role: 'buyer' },
  { name: 'Vendedor', email: 'seller@example.com', action: 'SIGN', role: 'seller' },
]

test('mapeia assinaturas da Autentique pelo email sem perder o papel local', () => {
  const result = mergeAutentiqueSignerStatus(configured, [{
    public_id: 'signature-1',
    email: 'BUYER@example.com',
    signed: { created_at: '2026-10-20T12:00:00Z' },
  }])

  assert.equal(result[0].role, 'buyer')
  assert.equal(result[0].publicId, 'signature-1')
  assert.equal(result[0].signedAt, '2026-10-20T12:00:00Z')
  assert.equal(result[1].signedAt, null)
})

test('deriva o andamento considerando assinaturas e recusas', () => {
  const pending = mergeAutentiqueSignerStatus(configured, [])
  assert.equal(deriveAutentiqueStatus(pending), 'pending')

  const partial = pending.map((signer, index) => ({ ...signer, signedAt: index === 0 ? 'now' : null }))
  assert.equal(deriveAutentiqueStatus(partial), 'partially_signed')

  const signed = pending.map((signer) => ({ ...signer, signedAt: 'now' }))
  assert.equal(deriveAutentiqueStatus(signed), 'signed')

  assert.equal(deriveAutentiqueStatus([{ ...pending[0], rejectedAt: 'now' }]), 'rejected')
})

test('usa sandbox por padrao e exige production explicitamente', () => {
  const previous = process.env.AUTENTIQUE_ENVIRONMENT
  delete process.env.AUTENTIQUE_ENVIRONMENT
  assert.equal(getAutentiqueEnvironment(), 'sandbox')
  process.env.AUTENTIQUE_ENVIRONMENT = 'production'
  assert.equal(getAutentiqueEnvironment(), 'production')
  if (previous === undefined) delete process.env.AUTENTIQUE_ENVIRONMENT
  else process.env.AUTENTIQUE_ENVIRONMENT = previous
})
