import { documentTemplateAccessWhere, forbiddenResponse } from '@/lib/access-control'
import { requireAuthenticatedUser } from '@/lib/auth'
import { readDocumentFile } from '@/lib/documentStorage'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string; versionId: string }> }

export async function GET(_: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const { id, versionId } = await params

  const version = await prisma.documentTemplateVersion.findFirst({
    where: {
      id: versionId,
      templateId: id,
      template: documentTemplateAccessWhere(userId),
    },
  })
  if (!version) return forbiddenResponse()

  const buffer = await readDocumentFile(version.filePath)
  const safeName = version.fileName.replace(/["\r\n]/g, '')
  return new NextResponse(buffer as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${safeName}"`,
    },
  })
}
