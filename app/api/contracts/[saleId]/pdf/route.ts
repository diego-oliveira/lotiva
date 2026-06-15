import { contractAccessWhere } from '@/lib/access-control'
import { requireAuthenticatedUser } from '@/lib/auth'
import { convertDocxToPdf } from '@/lib/docxDocuments'
import { readDocumentFile, saveDocumentFile } from '@/lib/documentStorage'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
type Params = { params: Promise<{ saleId: string }> }

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id
  const { saleId } = await params

  try {
    const contract = await prisma.contract.findFirst({
      where: { saleId, ...contractAccessWhere(currentUserId) },
    })
    if (!contract) return NextResponse.json({ error: 'Contrato nao encontrado.' }, { status: 404 })

    let pdfBuffer: Buffer
    if (contract.pdfPath) {
      pdfBuffer = await readDocumentFile(contract.pdfPath)
    } else {
      const docxBuffer = await readDocumentFile(contract.docxPath)
      pdfBuffer = await convertDocxToPdf(docxBuffer)
      const pdfPath = await saveDocumentFile(pdfBuffer, 'contracts', 'pdf')
      await prisma.contract.update({ where: { id: contract.id }, data: { pdfPath } })
    }

    if (new URL(req.url).searchParams.get('inline') !== '1') {
      await prisma.contractEvent.create({
        data: {
          contractId: contract.id,
          userId: currentUserId,
          type: 'downloaded',
          title: 'PDF baixado',
          description: 'PDF do contrato baixado.',
        },
      })
    }

    const disposition = new URL(req.url).searchParams.get('inline') === '1' ? 'inline' : 'attachment'
    return new NextResponse(pdfBuffer as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="Contrato_${contract.contractNumber}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Nao foi possivel gerar o PDF do contrato.',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    }, { status: 500 })
  }
}
