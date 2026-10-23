import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveWorkspaceScope, scopedDevelopmentIds, specificDevelopmentId, workspaceHref, workspaceMode, workspaceOptions } from '../lib/workspace'

test('workspace defaults to consolidated and restores a permitted selection', () => {
  assert.equal(resolveWorkspaceScope(null, ['a', 'b']), 'all')
  assert.equal(resolveWorkspaceScope(null, ['a', 'b'], 'b'), 'b')
  assert.equal(resolveWorkspaceScope(null, ['a'], 'all'), 'a')
  assert.equal(resolveWorkspaceScope(null, [], 'a'), '')
  assert.equal(resolveWorkspaceScope(null, ['a', 'b'], 'removed'), 'all')
})
test('explicit invalid project never falls back to another project', () => {
  assert.equal(resolveWorkspaceScope('foreign', ['a', 'b'], 'a'), '')
  assert.deepEqual(scopedDevelopmentIds('foreign', ['a', 'b']), [])
  assert.deepEqual(scopedDevelopmentIds('all', ['a', 'b']), ['a', 'b'])
  assert.deepEqual(scopedDevelopmentIds('a', ['a', 'b']), ['a'])
  assert.equal(specificDevelopmentId('all'), '')
})
test('navigation preserves context and explicit record links', () => {
  assert.equal(workspaceHref('/sales?status=open', 'all'), '/sales?status=open&developmentId=all')
  assert.equal(workspaceHref('/lots?developmentId=b&lotId=lot', 'a'), '/lots?developmentId=b&lotId=lot')
  assert.equal(workspaceHref('/clients', 'a'), '/clients')
  assert.equal(workspaceHref('/?chooseDevelopment=1', 'a'), '/?chooseDevelopment=1')
})
test('only authorized financial projects are offered on financial screens', () => {
  const options = [{ id: 'a', name: 'A', finance: true }, { id: 'b', name: 'B', finance: false }]
  for (const route of ['/', '/finance', '/commissions', '/distributions']) assert.deepEqual(workspaceOptions(route, options).map((item) => item.id), ['a'])
  assert.equal(workspaceOptions('/sales', options).length, 2)
  assert.equal(workspaceOptions('/proposals', options).length, 2)
  assert.equal(workspaceMode('/lots'), 'specific')
  assert.equal(workspaceMode('/distributions'), 'specific')
  assert.equal(workspaceMode('/sales'), 'consolidated')
})
