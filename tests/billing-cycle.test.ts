import assert from 'node:assert/strict'
import test from 'node:test'
import { buildChargeExternalReference, issueReceivableCharge, selectNextCycleReceivables } from '../lib/payments/billing-cycle'

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

test('rejeita emissao de boleto para vencimento passado antes do provedor', async () => {
  const calls: string[] = []
  const db = {
    paymentProviderConnection: {
      findUnique: async () => ({ id: 'conn-1', status: 'active', provider: 'inter', companyId: 'company-1' }),
    },
    receivable: {
      findUnique: async () => ({
        id: 'rec-1',
        kind: 'installment',
        sequence: 1,
        dueDate: new Date(Date.UTC(2020, 0, 15)),
        amount: { toString: () => '637.50' },
        status: 'pending',
        externalCharges: [],
        saleId: 'sale-1',
        sale: {
          user: {
            id: 'user-1',
            name: 'Cliente',
            email: 'cliente@example.com',
            cpf: '02100000001',
          },
          lot: {
            block: {
              development: { companyId: 'company-1' },
            },
          },
        },
      }),
    },
  }
  const provider = {
    name: 'inter' as const,
    createCustomer: async (input: any) => ({ ...input, id: 'customer-1' }),
    findCustomerByDocument: async () => null,
    listCharges: async () => {
      calls.push('listCharges')
      return { charges: [], hasMore: false, totalCount: 0 }
    },
    createCharge: async () => {
      calls.push('createCharge')
      throw new Error('nao deve chamar o provedor')
    },
    updateCharge: async () => { throw new Error('nao implementado') },
    getCharge: async () => { throw new Error('nao implementado') },
    cancelCharge: async () => { throw new Error('nao implementado') },
    getPixQrCode: async () => { throw new Error('nao implementado') },
    listChargesByCustomer: async () => { throw new Error('nao implementado') },
    ensurePaymentWebhook: async () => { throw new Error('nao implementado') },
  }

  await assert.rejects(
    issueReceivableCharge({
      connectionId: 'conn-1',
      receivableId: 'rec-1',
      provider,
      db: db as any,
    }),
    /vencimento em 2020-01-15/,
  )
  assert.deepEqual(calls, [])
})

test('permite boleto Inter futuro para parcela vencida sem alterar o vencimento original', async () => {
  let chargeInput: any = null
  const originalDueDate = new Date(Date.UTC(2020, 0, 15))
  const db = {
    paymentProviderConnection: {
      findUnique: async () => ({ id: 'conn-1', status: 'active', provider: 'inter', companyId: 'company-1', environment: 'production' }),
    },
    receivable: {
      findUnique: async () => ({
        id: 'rec-1',
        kind: 'installment',
        sequence: 1,
        dueDate: originalDueDate,
        amount: { toString: () => '637.50' },
        status: 'pending',
        externalCharges: [],
        saleId: 'sale-1',
        sale: {
          userId: 'user-1',
          user: {
            id: 'user-1',
            name: 'Cliente',
            email: 'cliente@example.com',
            cpf: '02100000001',
          },
          lot: {
            block: {
              development: { companyId: 'company-1' },
            },
          },
        },
      }),
    },
    externalCustomer: {
      upsert: async () => ({ providerCustomerId: 'customer-1' }),
    },
    externalCharge: {
      findUnique: async () => null,
      upsert: async ({ create }: any) => create,
    },
    financialAuditLog: {
      create: async () => ({}),
    },
  }
  const provider = {
    name: 'inter' as const,
    createCustomer: async (input: any) => ({ ...input, id: 'customer-1' }),
    findCustomerByDocument: async () => null,
    listCharges: async () => ({ charges: [], hasMore: false, totalCount: 0 }),
    createCharge: async (input: any) => {
      chargeInput = input
      return {
        ...input,
        id: 'charge-1',
        status: 'pending' as const,
        invoiceUrl: 'https://inter.example/cobranca',
        bankSlipUrl: '00190',
      }
    },
    updateCharge: async () => { throw new Error('nao implementado') },
    getCharge: async () => { throw new Error('nao implementado') },
    cancelCharge: async () => { throw new Error('nao implementado') },
    getPixQrCode: async () => { throw new Error('qr indisponivel') },
    listChargesByCustomer: async () => { throw new Error('nao implementado') },
    ensurePaymentWebhook: async () => { throw new Error('nao implementado') },
  }

  const result = await issueReceivableCharge({
    connectionId: 'conn-1',
    receivableId: 'rec-1',
    provider,
    db: db as any,
    chargeDueDate: '2099-01-20',
  })

  assert.equal(chargeInput.dueDate, '2099-01-20')
  assert.equal(result.charge.dueDate.toISOString().slice(0, 10), '2099-01-20')
  assert.equal(originalDueDate.toISOString().slice(0, 10), '2020-01-15')
})
