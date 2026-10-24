import test from 'node:test'
import assert from 'node:assert/strict'
import { dashboardAlerts } from '../lib/dashboard-alerts'

const today = new Date('2026-10-24T12:00:00Z')
const settings = { paymentMethods: 'cash', maxInstallments: 120, minDownPaymentPercentage: 0 }
const developments = [{ id: 'a', name: 'Terra Mar', settings }, { id: 'b', name: 'Gavião', settings: null }]

test('consolidated dashboard identifies each project and scopes every alert link', () => {
  const alerts = dashboardAlerts({ developments, today,
    lots: [{ developmentId: 'a', status: 'available' }],
    receivables: [
      { developmentId: 'a', status: 'pending', dueDate: new Date('2026-09-01'), balance: 100 },
      { developmentId: 'b', status: 'pending', dueDate: new Date('2026-09-01'), balance: 200 },
      { developmentId: 'b', status: 'paid', dueDate: new Date('2026-09-01'), balance: 0 },
      { developmentId: 'foreign', status: 'pending', dueDate: new Date('2026-09-01'), balance: 999 },
    ],
    reservations: Array.from({ length: 6 }, () => ({ developmentId: 'b' })),
  })
  for (const alert of alerts) {
    const url = new URL(alert.href, 'http://localhost')
    assert.equal(url.searchParams.get('developmentId'), alert.developmentId)
    assert.equal(alert.developmentName, alert.developmentId === 'a' ? 'Terra Mar' : 'Gavião')
  }
  const overdue = alerts.filter((alert) => alert.kind === 'overdue')
  assert.equal(overdue.length, 2)
  assert.match(overdue[0].description, /100,00/)
  assert.match(overdue[1].description, /200,00/)
  assert.ok(overdue.every((alert) => alert.href.includes('view=list&status=overdue')))
  assert.deepEqual(alerts.filter((alert) => alert.kind === 'stock').map((alert) => alert.developmentId), ['b'])
  assert.match(alerts.find((alert) => alert.kind === 'reservations')!.title, /^6 reserva/)
})

test('specific view creates only its own stock and availability alerts', () => {
  const alerts = dashboardAlerts({ developments: [developments[0]], today, lots: [{ developmentId: 'a', status: 'sold' }], receivables: [], reservations: [{ developmentId: 'b' }] })
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0].kind, 'availability')
  assert.equal(alerts[0].href, '/lots?developmentId=a')
})
