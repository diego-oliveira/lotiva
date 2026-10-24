import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '../app/generated/prisma'
const prisma = new PrismaClient()
const base = 'http://localhost:3000'
if (!['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error('Banco local obrigatório')
const userIds: string[] = []
const companyIds: string[] = []
const developmentIds: string[] = []
async function main() {
try {
  const user = await prisma.user.create({ data: { name: 'Workspace test', email: `${randomUUID()}@example.com` } }); userIds.push(user.id)
  const company = await prisma.company.create({ data: { name: 'Workspace test', logo: '' } }); companyIds.push(company.id)
  const roles = await Promise.all(['Financeiro', 'Vendedor'].map((name) => prisma.role.upsert({ where: { name }, create: { name }, update: {} })))
  for (let index = 0; index < 4; index++) {
    const development = await prisma.development.create({ data: { name: `workspace-${index}-${randomUUID()}`, logo: '', companyId: company.id } }); developmentIds.push(development.id)
    if (index < 3) await prisma.developmentUser.create({ data: { userId: user.id, developmentId: development.id, roles: { create: { roleId: roles[index === 2 ? 1 : 0].id } } } })
  }
  const token = randomUUID()
  await prisma.session.create({ data: { sessionToken: token, userId: user.id, expires: new Date(Date.now() + 600000) } })
  const headers = { cookie: `next-auth.session-token=${token}`, 'Content-Type': 'application/json' }
  const get = async () => { const response = await fetch(`${base}/api/me/workspace`, { headers }); assert.equal(response.status, 200); return response.json() }
  let state = await get()
  assert.equal(state.developmentId, 'all')
  assert.equal(state.developments.length, 3)
  assert.equal(state.developments.filter((item: { finance: boolean }) => item.finance).length, 2)
  const patch = (developmentId: string) => fetch(`${base}/api/me/workspace`, { method: 'PATCH', headers, body: JSON.stringify({ developmentId }) })
  assert.equal((await patch(developmentIds[3])).status, 403)
  assert.equal((await patch(developmentIds[1])).status, 200)
  assert.equal((await get()).developmentId, developmentIds[1])
  assert.equal((await patch('all')).status, 200)
  assert.equal((await get()).developmentId, 'all')
  const block = await prisma.block.create({ data: { developmentId: developmentIds[0], identifier: 'PAGINATION' } })
  const lot = await prisma.lot.create({ data: { identifier: '1', blockId: block.id, front: 10, back: 10, leftSide: 20, rightSide: 20, totalArea: 200, price: 5100, status: 'sold' } })
  const sale = await prisma.sale.create({ data: { userId: user.id, lotId: lot.id, salePrice: 5100, installmentCount: 51, installmentValue: 100, downPayment: 0, totalValue: 5100 } })
  await prisma.receivable.createMany({ data: Array.from({ length: 51 }, (_, index) => ({ saleId: sale.id, sequence: index + 1, dueDate: new Date('2026-01-01T15:00:00Z'), amount: 100, balance: 100, notes: `pagination-row-${String(index + 1).padStart(3, '0')}` })) })
  const page = await fetch(`${base}/finance?developmentId=all&view=list`, { headers })
  assert.equal(page.status, 200)
  const html = await page.text()
  assert.match(html, /Todos os loteamentos/)
  assert.equal(new Set(html.match(/pagination-row-\d{3}/g) ?? []).size, 50, 'Primeira página deve renderizar só 50 linhas')
  assert.match(html, /5\.100,00/, 'Totais devem incluir as 51 parcelas')
  const second = await fetch(`${base}/finance?developmentId=all&view=list&page=2&status=open&search=Workspace`, { headers })
  const secondHtml = await second.text()
  assert.equal(second.status, 200)
  assert.equal(new Set(secondHtml.match(/pagination-row-\d{3}/g) ?? []).size, 1)
  assert.match(secondHtml, /search=Workspace/, 'Paginação deve preservar a busca')
  const commissions = await fetch(`${base}/api/commissions?developmentId=all`, { headers })
  assert.equal(commissions.status, 200)
  console.log('Workspace: acesso, preferência, consolidado financeiro e comissões validados.')
} finally {
  await prisma.sale.deleteMany({ where: { lot: { block: { developmentId: { in: developmentIds } } } } })
  await prisma.lot.deleteMany({ where: { block: { developmentId: { in: developmentIds } } } })
  await prisma.block.deleteMany({ where: { developmentId: { in: developmentIds } } })
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.developmentUserRole.deleteMany({ where: { developmentUser: { developmentId: { in: developmentIds } } } })
  await prisma.developmentUser.deleteMany({ where: { developmentId: { in: developmentIds } } })
  await prisma.development.deleteMany({ where: { id: { in: developmentIds } } })
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } })
  await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  await prisma.$disconnect()
}

}
main().catch((error) => { console.error(error); process.exitCode = 1 })
