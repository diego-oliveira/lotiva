import { documentTemplateAccessWhere, forbiddenResponse } from '@/lib/access-control'
import { requireAuthenticatedUser } from '@/lib/auth'
import { validateTemplateContent } from '@/lib/document-templates'
import { hasCompanyPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const { id } = await params
  const data = await req.json()

  const template = await prisma.documentTemplate.findFirst({
    where: { id, ...documentTemplateAccessWhere(userId) },
    include: { versions: { orderBy: { version: 'desc' } } },
  })
  if (!template || !(await hasCompanyPermission(userId, template.companyId, 'manageSettings'))) {
    return forbiddenResponse()
  }

  const name = String(data.name || template.name).trim()
  const content = String(data.content || '')
  if (!name || !content.trim()) {
    return NextResponse.json({ error: 'Nome e conteudo sao obrigatorios.' }, { status: 400 })
  }

  const customVariables = await prisma.documentVariable.findMany({
    where: { companyId: template.companyId },
    select: { key: true },
  })
  const validation = validateTemplateContent(content, customVariables.map((variable) => variable.key))
  if (validation.unknownVariables.length > 0) {
    return NextResponse.json(
      { error: 'O modelo possui variaveis desconhecidas.', unknownVariables: validation.unknownVariables },
      { status: 400 },
    )
  }

  const draft = template.versions.find((version) => version.status === 'draft')
  const nextVersion = Math.max(0, ...template.versions.map((version) => version.version)) + 1
  const purpose = data.purpose || template.purpose

  const updated = await prisma.$transaction(async (tx) => {
    await tx.documentTemplate.update({
      where: { id },
      data: {
        name,
        purpose,
        description: String(data.description || '').trim() || null,
        status: template.status === 'archived' ? 'draft' : template.status,
      },
    })
    if (purpose !== 'sale_contract') {
      await tx.development.updateMany({
        where: { documentTemplateId: id },
        data: { documentTemplateId: null },
      })
    }

    return draft
      ? tx.documentTemplateVersion.update({
          where: { id: draft.id },
          data: { content, updatedAt: new Date() },
        })
      : tx.documentTemplateVersion.create({
          data: {
            templateId: id,
            createdById: userId,
            version: nextVersion,
            status: 'draft',
            content,
          },
        })
  })

  return NextResponse.json({ version: updated, validation })
}

export async function DELETE(_: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const { id } = await params

  const template = await prisma.documentTemplate.findFirst({
    where: { id, ...documentTemplateAccessWhere(userId) },
    select: { id: true, companyId: true },
  })
  if (!template || !(await hasCompanyPermission(userId, template.companyId, 'manageSettings'))) {
    return forbiddenResponse()
  }

  await prisma.$transaction(async (tx) => {
    await tx.development.updateMany({
      where: { documentTemplateId: id },
      data: { documentTemplateId: null },
    })
    await tx.documentTemplate.update({
      where: { id },
      data: { status: 'archived' },
    })
  })
  return NextResponse.json({ archived: true })
}
