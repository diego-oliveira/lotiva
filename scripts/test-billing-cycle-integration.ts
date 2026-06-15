import assert from 'node:assert/strict'
import { PrismaClient } from '../app/generated/prisma'
import { issueNextBillingCycle } from '../lib/payments/billing-cycle'
import { FakePaymentProvider } from '../lib/payments/fake-provider'

const prisma = new PrismaClient()
const rollbackMarker = new Error('ROLLBACK_TEST_TRANSACTION')

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setUTCMonth(next.getUTCMonth() + months)
  return next
}

async function main() {
  try {
    await prisma.$transaction(async (tx) => {
      const suffix = Date.now()
      const company = await tx.company.create({
        data: { name: `Empresa teste ${suffix}`, logo: '/test.png' },
      })
      const development = await tx.development.create({
        data: {
          name: `Empreendimento teste ${suffix}`,
          logo: '/test.png',
          companyId: company.id,
        },
      })
      const block = await tx.block.create({
        data: { identifier: 'A', developmentId: development.id },
      })
      const lot = await tx.lot.create({
        data: {
          identifier: '1',
          blockId: block.id,
          front: 10,
          back: 10,
          leftSide: 20,
          rightSide: 20,
          totalArea: 200,
          price: '80000.00',
          status: 'sold',
        },
      })
      const user = await tx.user.create({
        data: {
          name: 'Cliente de integracao',
          email: `billing-${suffix}@example.com`,
          cpf: String(suffix).slice(-11).padStart(11, '0'),
        },
      })
      const sale = await tx.sale.create({
        data: {
          userId: user.id,
          lotId: lot.id,
          installmentCount: 12,
          installmentValue: '600.00',
          downPayment: '8000.00',
          firstDueDate: new Date(Date.UTC(2026, 6, 20)),
          totalValue: '15200.00',
        },
      })
      await tx.receivable.createMany({
        data: Array.from({ length: 12 }, (_, index) => ({
          saleId: sale.id,
          kind: 'installment',
          sequence: index + 1,
          dueDate: addMonths(new Date(Date.UTC(2026, 6, 20)), index),
          amount: '600.00',
          balance: '600.00',
        })),
      })
      const connection = await tx.paymentProviderConnection.create({
        data: {
          companyId: company.id,
          provider: 'fake',
          environment: 'sandbox',
          status: 'active',
        },
      })
      const provider = new FakePaymentProvider()

      const first = await issueNextBillingCycle({
        connectionId: connection.id,
        saleId: sale.id,
        provider,
        db: tx,
      })
      assert.equal(first.charges.length, 12)
      assert.equal(first.cycle?.status, 'issued')

      const repeated = await issueNextBillingCycle({
        connectionId: connection.id,
        saleId: sale.id,
        provider,
        db: tx,
      })
      assert.equal(repeated.alreadyComplete, true)
      assert.equal(await tx.billingCycle.count({ where: { saleId: sale.id } }), 1)
      assert.equal(await tx.externalCharge.count({ where: { receivable: { saleId: sale.id } } }), 12)

      throw rollbackMarker
    })
  } catch (error) {
    if (error !== rollbackMarker) throw error
  } finally {
    await prisma.$disconnect()
  }

  console.log('Integracao de ciclo validada: 1 ciclo e 12 cobrancas sem duplicidade.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
