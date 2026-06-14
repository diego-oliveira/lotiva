import { documentTemplateAccessWhere, forbiddenResponse } from '@/lib/access-control'
import { requireAuthenticatedUser } from '@/lib/auth'
import { validateTemplateContent } from '@/lib/document-templates'
import { hasCompanyPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(_: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const { id } = await params

  const template = await prisma.documentTemplate.findFirst({
    where: { id, ...documentTemplateAccessWhere(userId) },
    include: {
      versions: {
        orderBy: { version: 'desc' },
      },
    },
  })
  if (!template || !(await hasCompanyPermission(userId, template.companyId, 'manageSettings'))) {
    return forbiddenResponse()
  }

  const draft = template.versions.find((version) => version.status === 'draft')
  if (!draft) {
    return NextResponse.json({ error: 'Salve uma nova versao antes de publicar.' }, { status: 400 })
  }

  const customVariables = await prisma.documentVariable.findMany({
    where: { companyId: template.companyId },
    select: { key: true },
  })
  const validation = validateTemplateContent(draft.content, customVariables.map((variable) => variable.key))
  if (validation.unknownVariables.length > 0) {
    return NextResponse.json(
      { error: 'Corrija as variaveis desconhecidas antes de publicar.', unknownVariables: validation.unknownVariables },
      { status: 400 },
    )
  }

  const published = await prisma.$transaction(async (tx) => {
    await tx.documentTemplateVersion.updateMany({
      where: { templateId: id, status: 'published' },
      data: { status: 'archived' },
    })
    const version = await tx.documentTemplateVersion.update({
      where: { id: draft.id },
      data: { status: 'published', publishedAt: new Date() },
    })
    await tx.documentTemplate.update({
      where: { id },
      data: { status: 'published' },
    })
    return version
  })

  return NextResponse.json({ version: published })
}
