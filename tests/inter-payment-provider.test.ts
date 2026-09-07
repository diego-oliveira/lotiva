import assert from 'node:assert/strict'
import test from 'node:test'
import {
  InterPaymentProvider,
  mapInterCharge,
  mapInterStatus,
  parseInterCredentials,
  serializeInterCredentials,
} from '../lib/payments/inter-provider'

const credentials = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  certificate: '-----BEGIN CERTIFICATE-----\ncert\n-----END CERTIFICATE-----',
  privateKey: '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----',
  accountNumber: '1234567',
}

test('serializa e valida credenciais Inter', () => {
  const serialized = serializeInterCredentials({
    ...credentials,
    certificate: credentials.certificate.replace(/\n/g, '\\n'),
    privateKey: credentials.privateKey.replace(/\n/g, '\\n'),
  })
  const parsed = parseInterCredentials(serialized)

  assert.equal(parsed.clientId, credentials.clientId)
  assert.equal(parsed.certificate, credentials.certificate)
  assert.equal(parsed.privateKey, credentials.privateKey)
  assert.equal(parsed.accountNumber, credentials.accountNumber)
})

test('mapeia status de cobranca Inter', () => {
  assert.equal(mapInterStatus('A_RECEBER'), 'pending')
  assert.equal(mapInterStatus('RECEBIDO'), 'received')
  assert.equal(mapInterStatus('ATRASADO'), 'overdue')
  assert.equal(mapInterStatus('CANCELADO'), 'cancelled')
  assert.equal(mapInterStatus('FALHA_EMISSAO'), 'unknown')
})

test('mapeia cobranca Inter para formato comum', () => {
  const charge = mapInterCharge({
    codigoSolicitacao: 'sol-123',
    seuNumero: 'receivable:1:v1',
    dataVencimento: '2026-10-20',
    valorNominal: '663.75',
    situacao: 'RECEBIDO',
    valorTotalRecebido: '663.75',
    origemRecebimento: 'PIX',
    linhaDigitavel: 'linha',
    pixCopiaECola: 'pix',
  })

  assert.equal(charge.id, 'sol-123')
  assert.equal(charge.amount, '663.75')
  assert.equal(charge.status, 'received')
  assert.equal(charge.paidAmount, '663.75')
  assert.equal(charge.externalReference, 'receivable:1:v1')
})

test('envia payload de emissao de cobranca Inter', async () => {
  const calls: Array<{ path: string; method?: string; body?: unknown; scope?: string }> = []
  const provider = new InterPaymentProvider(credentials, 'sandbox', async <T>(input: {
    path: string
    method?: string
    body?: unknown
    scope?: string
  }) => {
    calls.push({
      path: input.path,
      method: input.method,
      body: input.body,
      scope: input.scope,
    })
    return { codigoSolicitacao: 'sol-123' } as T
  })
  const customer = await provider.createCustomer({
    name: 'Carmen',
    cpfCnpj: '94273928515',
    email: 'carmen@example.com',
    externalReference: 'user:1',
  })

  const charge = await provider.createCharge({
    customerId: customer.id,
    amount: '663.75',
    dueDate: '2026-10-20',
    billingType: 'BOLETO',
    description: 'Parcela 1',
    externalReference: 'receivable:1:v1',
  })

  assert.equal(charge.id, 'sol-123')
  assert.equal(calls[0].path, '/cobrancas')
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].scope, 'boleto-cobranca.write')
  assert.deepEqual((calls[0].body as { formasRecebimento: string[] }).formasRecebimento, ['BOLETO', 'PIX'])
  assert.deepEqual((calls[0].body as { pagador: { cpfCnpj: string; nome: string; email?: string } }).pagador, {
    cpfCnpj: '94273928515',
    tipoPessoa: 'FISICA',
    nome: 'Carmen',
    email: 'carmen@example.com',
  })
})

test('lista cobrancas Inter com paginacao esperada pela API v3', async () => {
  const calls: Array<{ path: string; scope?: string }> = []
  const provider = new InterPaymentProvider(credentials, 'sandbox', async <T>(input: {
    path: string
    scope?: string
  }) => {
    calls.push({ path: input.path, scope: input.scope })
    return {
      totalElementos: 1,
      ultimaPagina: true,
      cobrancas: [
        {
          cobranca: {
            codigoSolicitacao: 'sol-123',
            seuNumero: 'r12345678901234',
            valorNominal: '663.75',
            dataVencimento: '2026-10-20',
            situacao: 'A_RECEBER',
          },
          boleto: { linhaDigitavel: 'linha' },
          pix: { pixCopiaECola: 'pix' },
        },
      ],
    } as T
  })

  const result = await provider.listCharges({ externalReference: 'r12345678901234', limit: 1 })

  assert.equal(calls[0].scope, 'boleto-cobranca.read')
  assert.match(calls[0].path, /paginacao\.itensPorPagina=1/)
  assert.match(calls[0].path, /paginacao\.paginaAtual=0/)
  assert.match(calls[0].path, /seuNumero=r12345678901234/)
  assert.equal(result.charges[0].id, 'sol-123')
  assert.equal(result.charges[0].bankSlipUrl, 'linha')
  assert.equal((result.charges[0] as { pixPayload?: string }).pixPayload, 'pix')
})
