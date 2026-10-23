import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { hasAccessToDevelopment, membershipWhere, financialDevelopmentAccessWhere } from '@/lib/access-control'
import { prisma } from '@/lib/prisma'
import { ALL_DEVELOPMENTS, resolveWorkspaceScope } from '@/lib/workspace'

export async function GET() {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response

  const [preference, developments, financialDevelopments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: auth.session.user.id },
      select: { lastDevelopmentId: true },
    }),
    prisma.development.findMany({
      where: membershipWhere(auth.session.user.id),
      select: { id: true, name: true, logo: true, company: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.development.findMany({ where: financialDevelopmentAccessWhere(auth.session.user.id), select: { id: true } }),
  ])
  const developmentId = resolveWorkspaceScope(null, developments.map((item) => item.id), preference?.lastDevelopmentId)
  const financeIds = new Set(financialDevelopments.map((item) => item.id))
  return NextResponse.json({ developmentId, developments: developments.map((item) => ({ ...item, finance: financeIds.has(item.id) })) })
}

export async function PATCH(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response

  const data = await req.json().catch(() => ({}))
  const developmentId = String(data.developmentId || '').trim()
  const allowed = developmentId === ALL_DEVELOPMENTS
    ? (await prisma.development.count({ where: membershipWhere(auth.session.user.id) })) > 0
    : developmentId && await hasAccessToDevelopment(auth.session.user.id, developmentId)
  if (!allowed) {
    return NextResponse.json({ error: 'Empreendimento invalido ou sem acesso.' }, { status: 403 })
  }

  await prisma.user.update({
    where: { id: auth.session.user.id },
    data: { lastDevelopmentId: developmentId },
  })

  return NextResponse.json({ developmentId })
}
