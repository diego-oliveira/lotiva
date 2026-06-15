import path from 'path'
import { documentTemplateAccessWhere, forbiddenResponse } from '@/lib/access-control'
import { requireAuthenticatedUser } from '@/lib/auth'
import { inspectDocx } from '@/lib/docxDocuments'
import { saveDocumentFile } from '@/lib/documentStorage'
import { hasCompanyPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
type Params = { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const { id } = await params
  const data = await req.formData()

  const template = await prisma.documentTemplate.findFirst({
    where: { id, ...documentTemplateAccessWhere(userId) },
    include: { versions: { orderBy: { version: 'desc' } } },
  })
  if (!template || !(await hasCompanyPermission(userId, template.companyId, 'manageSettings'))) {
    return forbiddenResponse()
  }

  const file = data.get('file')
  let uploaded: {
    filePath: string
    fileName: string
    fileHash: string
    variables: string[]
  } | null = null

  if (file instanceof File && file.size > 0) {
    if (path.extname(file.name).toLowerCase() !== '.docx') {
      return NextResponse.json({ error: 'Envie um arquivo no formato DOCX.' }, { status: 400 })
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'O arquivo DOCX deve ter no maximo 15 MB.' }, { status: 400 })
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const customVariables = await prisma.documentVariable.findMany({
      where: { companyId: template.companyId },
      select: { key: true },
    })
    const inspection = inspectDocx(buffer, customVariables.map((variable) => variable.key))
    if (inspection.unknownVariables.length > 0) {
      return NextResponse.json(
        { error: 'O DOCX possui variaveis desconhecidas.', unknownVariables: inspection.unknownVariables },
        { status: 400 },
      )
    }
    uploaded = {
      filePath: await saveDocumentFile(buffer, 'templates', 'docx'),
      fileName: file.name,
      fileHash: inspection.hash,
      variables: inspection.variables,
    }
  }

  const purpose = String(data.get('purpose') || template.purpose)
  const updated = await prisma.$transaction(async (tx) => {
    const metadata = await tx.documentTemplate.update({
      where: { id },
      data: {
        name: String(data.get('name') || template.name).trim(),
        purpose,
        description: String(data.get('description') || '').trim() || null,
        status: template.status === 'archived' ? 'draft' : template.status,
      },
    })

    if (purpose !== 'sale_contract') {
      await tx.development.updateMany({
        where: { documentTemplateId: id },
        data: { documentTemplateId: null },
      })
    }
    if (!uploaded) return { template: metadata, version: null }

    await tx.documentTemplateVersion.updateMany({
      where: { templateId: id, status: 'draft' },
      data: { status: 'archived' },
    })
    const version = await tx.documentTemplateVersion.create({
      data: {
        templateId: id,
        createdById: userId,
        version: Math.max(0, ...template.versions.map((item) => item.version)) + 1,
        status: 'draft',
        ...uploaded,
      },
    })
    return { template: metadata, version }
  })

  return NextResponse.json(updated)
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
