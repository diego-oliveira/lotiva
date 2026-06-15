import path from 'path'
import { documentTemplateAccessWhere, forbiddenResponse } from '@/lib/access-control'
import { requireAuthenticatedUser } from '@/lib/auth'
import { inspectDocx } from '@/lib/docxDocuments'
import { saveDocumentFile } from '@/lib/documentStorage'
import { hasCompanyPermission } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

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
          fileName: true,
          fileHash: true,
          variables: true,
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
  const data = await req.formData()
  const companyId = String(data.get('companyId') || '')
  const file = data.get('file')

  if (!companyId || !(await hasCompanyPermission(userId, companyId, 'manageSettings'))) {
    return forbiddenResponse()
  }
  if (!(file instanceof File) || path.extname(file.name).toLowerCase() !== '.docx') {
    return NextResponse.json({ error: 'Envie um arquivo no formato DOCX.' }, { status: 400 })
  }
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'O arquivo DOCX deve ter no maximo 15 MB.' }, { status: 400 })
  }

  const name = String(data.get('name') || '').trim()
  if (!name) return NextResponse.json({ error: 'Informe o nome do modelo.' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const customVariables = await prisma.documentVariable.findMany({
    where: { companyId },
    select: { key: true },
  })
  const inspection = inspectDocx(buffer, customVariables.map((variable) => variable.key))
  if (inspection.unknownVariables.length > 0) {
    return NextResponse.json(
      { error: 'O DOCX possui variaveis desconhecidas.', unknownVariables: inspection.unknownVariables },
      { status: 400 },
    )
  }

  const filePath = await saveDocumentFile(buffer, 'templates', 'docx')
  const template = await prisma.documentTemplate.create({
    data: {
      companyId,
      createdById: userId,
      name,
      type: 'contract',
      purpose: String(data.get('purpose') || 'sale_contract'),
      description: String(data.get('description') || '').trim() || null,
      versions: {
        create: {
          createdById: userId,
          version: 1,
          status: 'draft',
          filePath,
          fileName: file.name,
          fileHash: inspection.hash,
          variables: inspection.variables,
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
