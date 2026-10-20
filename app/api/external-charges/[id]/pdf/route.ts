import { NextResponse } from 'next/server'
import { forbiddenResponse, receivableAccessWhere } from '@/lib/access-control'
import { requireAuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPaymentProviderForConnection } from '@/lib/payments/factory'
import { InterPaymentProvider } from '@/lib/payments/inter-provider'

export const runtime = 'nodejs'
type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const { id } = await params

  const charge = await prisma.externalCharge.findFirst({
    where: {
      id,
      receivable: receivableAccessWhere(auth.session.user.id),
    },
    select: {
      providerChargeId: true,
      connectionId: true,
      connection: { select: { provider: true } },
    },
  })
  if (!charge) return forbiddenResponse()
  if (charge.connection.provider !== 'inter') {
    return NextResponse.json({ error: 'PDF autenticado esta disponivel apenas para cobrancas Inter.' }, { status: 400 })
  }

  const { provider } = await getPaymentProviderForConnection(charge.connectionId)
  if (!(provider instanceof InterPaymentProvider)) {
    return NextResponse.json({ error: 'Provedor Inter indisponivel.' }, { status: 400 })
  }

  const pdf = await provider.getChargePdfBase64(charge.providerChargeId)
  const disposition = new URL(req.url).searchParams.get('download') === '1' ? 'attachment' : 'inline'
  return new NextResponse(Buffer.from(pdf, 'base64'), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `${disposition}; filename="boleto-inter-${charge.providerChargeId}.pdf"`,
    },
  })
}
