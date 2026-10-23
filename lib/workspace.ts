export const ALL_DEVELOPMENTS = 'all'
export type WorkspaceOption = { id: string; name: string; logo?: string | null; finance?: boolean; company?: { name: string } | null }

export function workspaceMode(pathname: string): 'consolidated' | 'specific' | null {
  if (pathname === '/' || ['/sales', '/proposals', '/finance', '/commissions', '/my-commissions'].some((route) => pathname === route || pathname.startsWith(`${route}/`))) return 'consolidated'
  if (['/lots', '/distributions', '/partner-settlements'].some((route) => pathname === route || pathname.startsWith(`${route}/`))) return 'specific'
  return null
}

export function workspaceOptions(pathname: string, developments: WorkspaceOption[]) {
  return pathname === '/' || ['/finance', '/commissions', '/distributions', '/partner-settlements'].some((route) => pathname === route || pathname.startsWith(`${route}/`))
    ? developments.filter((item) => item.finance)
    : developments
}

export function specificDevelopmentId(value: string | null | undefined) {
  return value && value !== ALL_DEVELOPMENTS ? value : ''
}

export function resolveWorkspaceScope(requested: string | null | undefined, ids: string[], preferred?: string | null) {
  if (!ids.length) return ''
  const chosen = requested || preferred
  if (chosen === ALL_DEVELOPMENTS) return ids.length === 1 ? ids[0] : ALL_DEVELOPMENTS
  if (chosen && ids.includes(chosen)) return chosen
  // Never silently replace an explicit inaccessible project with another one.
  if (requested) return ''
  return ids.length === 1 ? ids[0] : ALL_DEVELOPMENTS
}

export function scopedDevelopmentIds(scope: string, ids: string[]) {
  return scope === ALL_DEVELOPMENTS ? ids : ids.includes(scope) ? [scope] : []
}

export function workspaceHref(href: string, scope?: string | null) {
  const url = new URL(href, 'http://lotiva.local')
  if (!workspaceMode(url.pathname) || !scope || url.searchParams.has('developmentId') || url.searchParams.get('chooseDevelopment') === '1') return href
  url.searchParams.set('developmentId', scope)
  return `${url.pathname}?${url.searchParams}${url.hash}`
}
