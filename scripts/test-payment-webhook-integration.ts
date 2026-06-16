import assert from 'node:assert/strict'
import { PrismaClient } from '../app/generated/prisma'
import {
  persistAsaasWebhookEvent,
  processPendingWebhookEvents,
} from '../lib/payments/webhooks'

const prisma = new PrismaClient()

async function main() {
  const suffix = Date.now()
  let companyId = ''
  let developmentId = ''
  let blockId = ''
  let lotId = ''
  let userId = ''
  let saleId = ''
  let receivableId = ''
  let connectionId = ''

  try {
    const company = await prisma.company.create({
      data: { name: `Webhook teste ${suffix}`, logo: '/test.png' },
    })
    companyId = company.id
    const development = await prisma.development.create({
      data: { name: `Webhook empreendimento ${suffix}`, logo: '/test.png', companyId },
    })
    developmentId = development.id
    const block = await prisma.block.create({
      data: { identifier: 'W', developmentId },
    })
    blockId = block.id
    const lot = await prisma.lot.create({
      data: {
        identifier: '1',
        blockId,
        front: 10,
        back: 10,
        leftSide: 20,
        rightSide: 20,
        totalArea: 200,
        price: '1000.00',
        status: 'sold',
      },
    })
    lotId = lot.id
    const user = await prisma.user.create({
      data: {
        name: 'Cliente webhook',
        email: `webhook-${suffix}@example.com`,
        cpf: String(suffix).slice(-11).padStart(11, '0'),
      },
    })
    userId = user.id
    const sale = await prisma.sale.create({
      data: {
        userId,
        lotId,
        installmentCount: 1,
        installmentValue: '600.00',
        downPayment: '400.00',
        totalValue: '1000.00',
      },
    })
    saleId = sale.id
    const receivable = await prisma.receivable.create({
      data: {
        saleId,
        sequence: 1,
        dueDate: new Date('2026-07-20T12:00:00'),
        amount: '600.00',
        balance: '600.00',
      },
    })
    receivableId = receivable.id
    const connection = await prisma.paymentProviderConnection.create({
      data: {
        companyId,
        provider: 'asaas',
        environment: 'sandbox',
        status: 'active',
      },
    })
    connectionId = connection.id
    await prisma.externalCharge.create({
      data: {
        connectionId,
        receivableId,
        providerChargeId: `pay_test_${suffix}`,
        externalReference: `receivable:${receivableId}:v1`,
        billingType: 'BOLETO',
        status: 'pending',
        amount: '600.00',
        dueDate: new Date('2026-07-20T12:00:00'),
      },
    })

    const payload = {
      id: `evt_test_${suffix}`,
      event: 'PAYMENT_RECEIVED',
      dateCreated: '2026-07-20T12:00:00',
      payment: {
        id: `pay_test_${suffix}`,
        customer: `cus_test_${suffix}`,
        value: 600,
        netValue: 597,
        dueDate: '2026-07-20',
        billingType: 'BOLETO' as const,
        externalReference: `receivable:${receivableId}:v1`,
        status: 'RECEIVED',
        paymentDate: '2026-07-20',
      },
    }
    assert.equal((await persistAsaasWebhookEvent({ connectionId, payload })).duplicate, false)
    assert.equal((await persistAsaasWebhookEvent({ connectionId, payload })).duplicate, true)
    assert.equal(await prisma.paymentWebhookEvent.count({ where: { connectionId } }), 1)

    const result = await processPendingWebhookEvents()
    assert.equal(result.processed, 1)
    const updated = await prisma.receivable.findUniqueOrThrow({ where: { id: receivableId } })
    assert.equal(updated.status, 'paid')
    assert.equal(updated.paidAmount.toString(), '600')
    const charge = await prisma.externalCharge.findFirstOrThrow({ where: { connectionId } })
    assert.equal(charge.netPaidAmount?.toString(), '597')
    assert.equal(charge.feeAmount?.toString(), '3')

    const repeated = await processPendingWebhookEvents()
    assert.equal(repeated.processed, 0)
  } finally {
    if (companyId) {
      await prisma.financialAuditLog.deleteMany({ where: { companyId } })
      await prisma.paymentWebhookEvent.deleteMany({ where: { connectionId } })
      await prisma.externalCharge.deleteMany({ where: { connectionId } })
      await prisma.paymentProviderConnection.deleteMany({ where: { id: connectionId } })
      await prisma.receivable.deleteMany({ where: { id: receivableId } })
      await prisma.sale.deleteMany({ where: { id: saleId } })
      await prisma.lot.deleteMany({ where: { id: lotId } })
      await prisma.block.deleteMany({ where: { id: blockId } })
      await prisma.development.deleteMany({ where: { id: developmentId } })
      await prisma.company.deleteMany({ where: { id: companyId } })
      await prisma.user.deleteMany({ where: { id: userId } })
    }
    await prisma.$disconnect()
  }

  console.log('Webhook validado: evento duplicado processado uma vez e parcela conciliada.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
