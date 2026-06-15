import { contractAccessWhere } from '@/lib/access-control'
import { requireAuthenticatedUser } from '@/lib/auth'
import { readDocumentFile } from '@/lib/documentStorage'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ saleId: string }> }

export async function GET(_: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const { saleId } = await params
  const contract = await prisma.contract.findFirst({
    where: { saleId, ...contractAccessWhere(auth.session.user.id) },
  })
  if (!contract) return NextResponse.json({ error: 'Contrato nao encontrado.' }, { status: 404 })

  const buffer = await readDocumentFile(contract.docxPath)
  return new NextResponse(buffer as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="Contrato_${contract.contractNumber}.docx"`,
    },
  })
}

