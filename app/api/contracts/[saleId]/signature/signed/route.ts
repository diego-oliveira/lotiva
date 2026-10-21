import { contractAccessWhere } from '@/lib/access-control'
import { requireAuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
type Params = { params: Promise<{ saleId: string }> }

export async function GET(_: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const { saleId } = await params
  const contract = await prisma.contract.findFirst({
    where: { saleId, ...contractAccessWhere(auth.session.user.id) },
  })
  if (!contract?.signatureSignedUrl || contract.signatureStatus !== 'signed') {
    return NextResponse.json({ error: 'Documento assinado ainda nao esta disponivel.' }, { status: 404 })
  }

  const response = await fetch(contract.signatureSignedUrl, { cache: 'no-store' })
  if (!response.ok) return NextResponse.json({ error: 'Nao foi possivel baixar o documento assinado.' }, { status: 502 })
  return new NextResponse(await response.arrayBuffer(), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Contrato_${contract.contractNumber}_assinado.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
