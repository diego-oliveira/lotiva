import { forbiddenResponse } from '@/lib/access-control'
import { requireAuthenticatedUser } from '@/lib/auth'
import { hasCompanyPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

function normalizeKey(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export async function GET(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const companyId = new URL(req.url).searchParams.get('companyId')
  if (!companyId || !(await hasCompanyPermission(userId, companyId, 'manageSettings'))) {
    return forbiddenResponse()
  }

  const variables = await prisma.documentVariable.findMany({
    where: { companyId },
    orderBy: { label: 'asc' },
  })
  return NextResponse.json(variables)
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const data = await req.json()
  if (!data.companyId || !(await hasCompanyPermission(userId, data.companyId, 'manageSettings'))) {
    return forbiddenResponse()
  }

  const key = normalizeKey(data.key || data.label)
  const label = String(data.label || '').trim()
  if (!key || !label) {
    return NextResponse.json({ error: 'Informe o nome e o identificador da variavel.' }, { status: 400 })
  }

  try {
    const variable = await prisma.documentVariable.create({
      data: {
        companyId: data.companyId,
        key,
        label,
        type: data.type || 'text',
        required: Boolean(data.required),
        defaultValue: String(data.defaultValue || '').trim() || null,
      },
    })
    return NextResponse.json(variable, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ja existe uma variavel com este identificador.' }, { status: 409 })
    }
    throw error
  }
}
