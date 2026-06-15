import assert from 'node:assert/strict'
import test from 'node:test'
import { AsaasPaymentProvider } from '../lib/payments/asaas-provider'

test('envia autenticacao e mapeia uma cobranca Asaas', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init })
    return new Response(JSON.stringify({
      id: 'pay_123',
      customer: 'cus_123',
      value: 600,
      dueDate: '2026-07-20',
      billingType: 'BOLETO',
      description: 'Parcela 1',
      externalReference: 'receivable-1',
      status: 'PENDING',
      invoiceUrl: 'https://sandbox.asaas.com/i/123',
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const provider = new AsaasPaymentProvider('aact_hmlg_sandbox-key', 'sandbox', fetcher)

  const charge = await provider.createCharge({
    customerId: 'cus_123',
    amount: '600.00',
    dueDate: '2026-07-20',
    billingType: 'BOLETO',
    description: 'Parcela 1',
    externalReference: 'receivable-1',
    interest: { percentage: '1' },
    fine: { percentage: '2' },
  })

  assert.equal(calls[0].url, 'https://api-sandbox.asaas.com/v3/payments')
  assert.equal(new Headers(calls[0].init?.headers).get('access_token'), '$aact_hmlg_sandbox-key')
  assert.equal(charge.amount, '600.00')
  assert.equal(charge.status, 'pending')
})

test('apresenta os erros retornados pela API Asaas', async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({
    errors: [{ code: 'invalid_value', description: 'Valor invalido.' }],
  }), { status: 400, headers: { 'content-type': 'application/json' } })
  const provider = new AsaasPaymentProvider('sandbox-key', 'sandbox', fetcher)

  await assert.rejects(
    () => provider.getCharge('pay_invalid'),
    /Asaas 400: Valor invalido/,
  )
})
