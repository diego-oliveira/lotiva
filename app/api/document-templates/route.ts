import { documentTemplateAccessWhere, forbiddenResponse } from '@/lib/access-control'
import { requireAuthenticatedUser } from '@/lib/auth'
import { defaultContractTemplate, validateTemplateContent } from '@/lib/document-templates'
import { hasCompanyPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const templates = await prisma.documentTemplate.findMany({
    where: documentTemplateAccessWhere(userId),
    include: {
      company: { select: { id: true, name: true } },
      versions: {
        orderBy: { version: 'desc' },
        select: {
          id: true,
          version: true,
          status: true,
          content: true,
          publishedAt: true,
          updatedAt: true,
        },
      },
      _count: { select: { developments: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(templates)
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const data = await req.json()

  if (!data.companyId || !(await hasCompanyPermission(userId, data.companyId, 'manageSettings'))) {
    return forbiddenResponse()
  }

  const name = String(data.name || '').trim()
  const content = String(data.content || defaultContractTemplate)
  if (!name) return NextResponse.json({ error: 'Informe o nome do modelo.' }, { status: 400 })

  const customVariables = await prisma.documentVariable.findMany({
    where: { companyId: data.companyId },
    select: { key: true },
  })
  const validation = validateTemplateContent(content, customVariables.map((variable) => variable.key))
  if (validation.unknownVariables.length > 0) {
    return NextResponse.json(
      { error: 'O modelo possui variaveis desconhecidas.', unknownVariables: validation.unknownVariables },
      { status: 400 },
    )
  }

  const template = await prisma.documentTemplate.create({
    data: {
      companyId: data.companyId,
      createdById: userId,
      name,
      type: data.type || 'contract',
      purpose: data.purpose || 'sale_contract',
      description: String(data.description || '').trim() || null,
      versions: {
        create: {
          createdById: userId,
          version: 1,
          status: 'draft',
          content,
        },
      },
    },
    include: {
      company: { select: { id: true, name: true } },
      versions: true,
    },
  })

  return NextResponse.json(template, { status: 201 })
}
