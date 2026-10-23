import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PrismaClient } from '../app/generated/prisma'

const prisma = new PrismaClient()
const base = process.env.PARTNER_TEST_URL || 'http://localhost:3000'
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname) || !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error('Este teste usa somente aplicação e banco locais.')
const fixture = { users: [] as string[], companies: [] as string[], developments: [] as string[] }

async function main() {
  try {
    const suffix = randomUUID()
    const financeRole = await prisma.role.upsert({ where: { name: 'Financeiro' }, create: { name: 'Financeiro' }, update: {} })
    const brokerRole = await prisma.role.upsert({ where: { name: 'Vendedor' }, create: { name: 'Vendedor' }, update: {} })
    const finance = await prisma.user.create({ data: { name: 'Teste repasse financeiro', email: `settlement-finance-${suffix}@example.com` } })
    fixture.users.push(finance.id)
    const broker = await prisma.user.create({ data: { name: 'Teste repasse corretor', email: `settlement-broker-${suffix}@example.com` } })
    fixture.users.push(broker.id)
    const company = await prisma.company.create({ data: { name: `Teste repasses ${suffix}`, logo: '' } })
    fixture.companies.push(company.id)
    const otherCompany = await prisma.company.create({ data: { name: `Teste isolamento ${suffix}`, logo: '' } })
    fixture.companies.push(otherCompany.id)
    const development = await prisma.development.create({ data: { name: 'Empreendimento teste repasse', logo: '', companyId: company.id } })
    fixture.developments.push(development.id)
    const other = await prisma.development.create({ data: { name: 'Empreendimento sem acesso', logo: '', companyId: otherCompany.id } })
    fixture.developments.push(other.id)
    for (const [userId, roleId] of [[finance.id, financeRole.id], [broker.id, brokerRole.id]]) {
      await prisma.developmentUser.create({ data: { userId, developmentId: development.id, roles: { create: { roleId } } } })
    }
    const token = randomUUID()
    const brokerToken = randomUUID()
    for (const [userId, sessionToken] of [[finance.id, token], [broker.id, brokerToken]]) await prisma.session.create({ data: { userId, sessionToken, expires: new Date(Date.now() + 3600000) } })
    const month = '2020-09'
    const request = async (body: Record<string, unknown> | null, status: number, cookie = token, dev = development.id, referenceMonth = month) => {
      const response = await fetch(`${base}/api/partner-settlements${body ? '' : `?developmentId=${dev}&month=${referenceMonth}`}`, {
        method: body ? 'POST' : 'GET', headers: { cookie: `next-auth.session-token=${cookie}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify({ developmentId: dev, month: referenceMonth, ...body }) } : {}),
      })
      const payload = await response.json()
      assert.equal(response.status, status, `Status ${response.status}: ${JSON.stringify(payload)}`)
      return payload
    }
    await request(null, 403, brokerToken)
    await request(null, 403, token, other.id)
    await request({ action: 'create' }, 403, brokerToken)
    const proofForm = new FormData()
    proofForm.set('file', new File(['%PDF-1.4\n%%EOF'], 'comprovante.pdf', { type: 'application/pdf' }))
    const proofEndpoint = `${base}/api/partner-settlements/proofs?developmentId=${development.id}`
    assert.equal((await fetch(proofEndpoint, { method: 'POST', headers: { cookie: `next-auth.session-token=${brokerToken}` }, body: proofForm })).status, 403)
    const proofResponse = await fetch(proofEndpoint, { method: 'POST', headers: { cookie: `next-auth.session-token=${token}` }, body: proofForm })
    assert.equal(proofResponse.status, 201)
    const proof = await proofResponse.json() as { url: string }
    assert.equal((await fetch(`${base}${proof.url}`)).status, 401)
    assert.equal((await fetch(`${base}${proof.url}`, { headers: { cookie: `next-auth.session-token=${brokerToken}` } })).status, 403)
    const download = await fetch(`${base}${proof.url}`, { headers: { cookie: `next-auth.session-token=${token}` } })
    assert.equal(download.status, 200)
    assert.equal(download.headers.get('cache-control'), 'private, no-store')
    assert.equal(await download.text(), '%PDF-1.4\n%%EOF')
    await request({ action: 'agreement', partnerName: 'Terrenista teste', percentage: 50, pixKey: '', recurringCosts: [{ description: 'Sistema', amount: 250 }] }, 200)
    await request({ action: 'create' }, 200)
    await request({ action: 'create' }, 409)
    const block = await prisma.block.create({ data: { developmentId: development.id, identifier: 'A' } })
    const lot = await prisma.lot.create({ data: { identifier: '1', blockId: block.id, front: 10, back: 10, leftSide: 20, rightSide: 20, totalArea: 200, price: 100000, status: 'sold' } })
    const sale = await prisma.sale.create({ data: { userId: broker.id, lotId: lot.id, salePrice: 100000, installmentCount: 10, installmentValue: 8000, downPayment: 20000, totalValue: 100000 } })
    const receipt = await prisma.receivable.create({ data: { saleId: sale.id, kind: 'down_payment', sequence: 1, dueDate: new Date('2020-09-05T15:00:00Z'), amount: 30000, paidAmount: 20000, balance: 10000, status: 'pending', paidAt: new Date('2020-10-01T02:59:59Z') } })
    await prisma.receivable.create({ data: { saleId: sale.id, sequence: 1, dueDate: new Date('2020-10-01T15:00:00Z'), amount: 8000, paidAmount: 8000, balance: 0, status: 'paid', paidAt: new Date('2020-10-01T03:00:00Z') } })
    const commission = await prisma.saleCommission.create({ data: { saleId: sale.id, userId: broker.id, percentage: 6, amount: 6000 } })
    const commissionPayment = await prisma.commissionPayment.create({ data: { commissionId: commission.id, amount: 2000, paidAt: new Date('2020-09-20T15:00:00Z') } })
    let state = await request(null, 200)
    assert.equal(state.snapshot.receipts.length, 1)
    assert.equal(state.snapshot.receiptsTotal, 20000)
    await request({ action: 'save', version: state.settlement.version, expenses: [...state.settlement.expenses, { description: 'Outros', amount: 750, paidAt: '2020-09-10', proofUrl: proof.url }], adjustments: [] }, 200)
    await request({ action: 'save', version: state.settlement.version, expenses: [], adjustments: [] }, 409)
    state = await request(null, 200)
    assert.equal(state.snapshot.partnerAmount, 8500)
    await prisma.receivable.update({ where: { id: receipt.id }, data: { paidAmount: 21000, balance: 9000 } })
    await request({ action: 'close', version: state.settlement.version, previewToken: state.previewToken }, 409)
    state = await request(null, 200)
    assert.equal(state.snapshot.partnerAmount, 9000)
    await request({ action: 'close', version: state.settlement.version, previewToken: state.previewToken }, 200)
    state = await request(null, 200)
    assert.equal(state.sourceChanged, false)
    assert.equal(state.settlement.status, 'closed')
    await request({ action: 'save', version: state.settlement.version, expenses: [], adjustments: [] }, 409)
    const payment = { action: 'payment', version: state.settlement.version, paymentId: randomUUID(), amount: 3000, paidAt: '2020-10-10', notes: '', proofUrl: '' }
    await request(payment, 200)
    await request(payment, 200)
    assert.equal(await prisma.partnerPayment.count({ where: { settlementId: state.settlement.id } }), 1)
    await request({ ...payment, amount: 3001 }, 409)
    state = await request(null, 200)
    assert.equal(state.payment.remaining, 6000)
    await request({ ...payment, paymentId: randomUUID(), version: state.settlement.version, amount: 6000.01 }, 400)
    const responses = await Promise.all([1, 2].map(async () => {
      const response = await fetch(`${base}/api/partner-settlements`, { method: 'POST', headers: { cookie: `next-auth.session-token=${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payment, developmentId: development.id, month, paymentId: randomUUID(), version: state.settlement.version, amount: 6000 }) })
      return response.status
    }))
    assert.deepEqual(responses.sort(), [200, 409])
    await prisma.receivable.update({ where: { id: receipt.id }, data: { paidAmount: 22000, balance: 8000 } })
    state = await request(null, 200)
    assert.equal(state.snapshot.receiptsTotal, 21000)
    assert.equal(state.sourceChanged, true)
    assert.equal(state.payment.remaining, 0)
    assert.equal(state.payment.status, 'paid')
    assert.equal(state.settlement.payments.length, 2)
    assert.ok(await prisma.financialAuditLog.count({ where: { companyId: company.id, action: 'partner_settlement_closed' } }))
    const commissionEndpoint = `${base}/api/commissions/${commission.id}/payments/${commissionPayment.id}`
    const changeDate = async (paidAt: string, expectedStatus: number, previousPaidAt = commissionPayment.paidAt.toISOString(), sessionToken = token) => {
      const response = await fetch(commissionEndpoint, { method: 'PATCH', headers: { cookie: `next-auth.session-token=${sessionToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ paidAt, previousPaidAt }) })
      const payload = await response.json()
      assert.equal(response.status, expectedStatus, JSON.stringify(payload))
    }
    await changeDate('2020-09-21', 403, undefined, brokerToken)
    await changeDate('2020-02-30', 400)
    await changeDate('2020-09-21', 200)
    await changeDate('2020-09-22', 409)
    const changedPayment = await prisma.commissionPayment.findUniqueOrThrow({ where: { id: commissionPayment.id } })
    assert.equal(Number(changedPayment.amount), 2000)
    assert.equal(changedPayment.paidAt.toISOString(), '2020-09-21T15:00:00.000Z')
    assert.ok(await prisma.financialAuditLog.count({ where: { companyId: company.id, action: 'commission_payment_date_updated' } }))

    await request({ action: 'reopen', version: state.settlement.version, reason: '' }, 400)
    await request({ action: 'reopen', version: state.settlement.version, reason: 'Corrigir custos e conferir recebimento' }, 200)
    state = await request(null, 200)
    assert.equal(state.settlement.status, 'draft')
    assert.equal(state.settlement.revisions.length, 1)
    assert.equal(state.snapshot.receiptsTotal, 22000)
    assert.equal(state.settlement.payments.length, 2)
    const archived = await prisma.partnerSettlementRevision.findUniqueOrThrow({ where: { id: state.settlement.revisions[0].id } })
    assert.equal((archived.snapshot as { receiptsTotal: number }).receiptsTotal, 21000)
    const savedExpenses = state.settlement.expenses
    await request({ action: 'save', version: state.settlement.version, expenses: [...savedExpenses, { description: 'Campanha na internet', amount: 2000, paidAt: '2020-09-25', proofUrl: '' }], adjustments: [] }, 200)
    state = await request(null, 200)
    await request({ action: 'close', version: state.settlement.version, previewToken: state.previewToken }, 409)
    await request({ action: 'save', version: state.settlement.version, expenses: savedExpenses, adjustments: [] }, 200)
    state = await request(null, 200)
    await request({ action: 'close', version: state.settlement.version, previewToken: state.previewToken }, 200)
    state = await request(null, 200)
    assert.equal(state.payment.remaining, 500)
    assert.equal(state.snapshot.partnerAmount, 9500)
    const reportEndpoint = `${base}/api/partner-settlements/${state.settlement.id}/report`
    assert.equal((await fetch(reportEndpoint, { headers: { cookie: `next-auth.session-token=${brokerToken}` } })).status, 404)
    if (process.env.PARTNER_TEST_PDF === 'true') {
      const response = await fetch(`${reportEndpoint}?revision=${archived.id}`, { headers: { cookie: `next-auth.session-token=${token}` } })
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('content-type'), 'application/pdf')
      const buffer = Buffer.from(await response.arrayBuffer())
      assert.equal(buffer.subarray(0, 5).toString(), '%PDF-')
      await writeFile('/private/tmp/lotiva-settlement-qa.pdf', buffer)
    }
    // A second month exercises the generic rules against real HTTP endpoints.
    const newMonth = '2020-10'
    const recipients = [
      { id: 'person-a', kind: 'person', name: 'Participante A', percentage: 20, pixKey: '' },
      { id: 'company-b', kind: 'company', name: 'Empresa B Ltda', percentage: 30, pixKey: '' },
    ]
    const saveRules = (rules: typeof recipients, version: number) => request({ action: 'agreement', participants: rules, defaultCosts: [], version }, 200)
    await request({ action: 'agreement', participants: recipients.map((item) => ({ ...item, percentage: 51 })), defaultCosts: [], version: state.agreement.version }, 400)
    await saveRules(recipients, state.agreement.version)
    await request({ action: 'create', month: newMonth }, 200)
    let distribution = await request(null, 200, token, development.id, newMonth)
    assert.equal(distribution.settlement.expenses.length, 0, 'Nenhuma mensalidade deve ser lançada automaticamente')
    assert.equal(distribution.snapshot.netAmount, 8000)
    assert.equal(distribution.snapshot.partnerAmount, 4000)
    assert.equal(distribution.snapshot.operationAmount, 4000)
    assert.deepEqual(distribution.allocations.map((item: { amount: number }) => item.amount), [1600, 2400])
    await request({ action: 'close', month: newMonth, version: distribution.settlement.version, previewToken: distribution.previewToken }, 200)
    distribution = await request(null, 200, token, development.id, newMonth)
    const transfer = { action: 'payment', month: newMonth, version: distribution.settlement.version, paymentId: randomUUID(), participantId: 'person-a', amount: 1000, paidAt: '2020-10-20', notes: '', proofUrl: '' }
    await request(transfer, 200)
    await request(transfer, 200)
    await request({ ...transfer, participantId: 'company-b' }, 409)
    distribution = await request(null, 200, token, development.id, newMonth)
    assert.equal(distribution.allocations[0].remaining, 600)
    assert.equal(distribution.allocations[1].remaining, 2400)
    await request({ ...transfer, paymentId: randomUUID(), version: distribution.settlement.version, amount: 600.01 }, 400)
    await request({ ...transfer, participantId: 'company-b', paymentId: randomUUID(), version: distribution.settlement.version, amount: 1200 }, 200)
    distribution = await request(null, 200, token, development.id, newMonth)
    assert.equal(distribution.allocations[0].remaining, 600)
    assert.equal(distribution.allocations[1].remaining, 1200)
    await request({ action: 'reopen', month: newMonth, version: distribution.settlement.version, reason: 'Conferir regras de distribuição' }, 200)
    await saveRules(recipients.map((item, index) => ({ ...item, percentage: index === 0 ? 10 : 50 })), distribution.agreement.version)
    distribution = await request(null, 200, token, development.id, newMonth)
    await request({ action: 'applyAgreement', month: newMonth, version: distribution.settlement.version }, 200)
    distribution = await request(null, 200, token, development.id, newMonth)
    // The aggregate covers all payments, but person A's share does not: must reject.
    assert.ok(distribution.snapshot.partnerAmount > distribution.payment.paid)
    await request({ action: 'close', month: newMonth, version: distribution.settlement.version, previewToken: distribution.previewToken }, 409)
    await saveRules([recipients[1]], distribution.agreement.version)
    distribution = await request(null, 200, token, development.id, newMonth)
    await request({ action: 'applyAgreement', month: newMonth, version: distribution.settlement.version }, 409)
    await saveRules(recipients, distribution.agreement.version)
    distribution = await request(null, 200, token, development.id, newMonth)
    await request({ action: 'applyAgreement', month: newMonth, version: distribution.settlement.version }, 200)
    distribution = await request(null, 200, token, development.id, newMonth)
    await request({ action: 'close', month: newMonth, version: distribution.settlement.version, previewToken: distribution.previewToken }, 200)
    distribution = await request(null, 200, token, development.id, newMonth)
    assert.equal(distribution.snapshot.operationAmount, 4000)
    assert.equal(distribution.settlement.payments.length, 2)
    if (process.env.PARTNER_TEST_PDF === 'true') {
      const response = await fetch(`${base}/api/partner-settlements/${distribution.settlement.id}/report`, { headers: { cookie: `next-auth.session-token=${token}` } })
      assert.equal(response.status, 200)
      const buffer = Buffer.from(await response.arrayBuffer())
      assert.equal(buffer.subarray(0, 5).toString(), '%PDF-')
      await writeFile('/private/tmp/lotiva-distribution-qa.pdf', buffer)
    }
    console.log('Integração validada: permissões, compatibilidade com um sócio, múltiplos participantes, despesas sem taxa automática, percentuais até 100%, pagamentos e saldos individuais, reabertura sem transferir saldo entre participantes, PDF e idempotência.')
  } catch (error) {
    console.error('Falha na validação integrada:', error)
    throw error
  } finally {
    // All records below belong exclusively to this run's fixture.
    await prisma.partnerPayment.deleteMany({ where: { settlement: { developmentId: { in: fixture.developments } } } })
    await prisma.partnerSettlementRevision.deleteMany({ where: { settlement: { developmentId: { in: fixture.developments } } } })
    await prisma.partnerSettlement.deleteMany({ where: { developmentId: { in: fixture.developments } } })
    await prisma.partnerAgreement.deleteMany({ where: { developmentId: { in: fixture.developments } } })
    await prisma.sale.deleteMany({ where: { lot: { block: { developmentId: { in: fixture.developments } } } } })
    await prisma.lot.deleteMany({ where: { block: { developmentId: { in: fixture.developments } } } })
    await prisma.block.deleteMany({ where: { developmentId: { in: fixture.developments } } })
    await prisma.developmentUserRole.deleteMany({ where: { developmentUser: { developmentId: { in: fixture.developments } } } })
    await prisma.developmentUser.deleteMany({ where: { developmentId: { in: fixture.developments } } })
    await prisma.development.deleteMany({ where: { id: { in: fixture.developments } } })
    await prisma.company.deleteMany({ where: { id: { in: fixture.companies } } })
    await prisma.user.deleteMany({ where: { id: { in: fixture.users } } })
    for (const id of fixture.developments) await rm(path.join(process.env.PARTNER_PROOF_DIR || path.join(process.cwd(), 'storage', 'partner-proofs'), id), { recursive: true, force: true })
    await prisma.$disconnect()
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
