import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { contractAccessWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ saleId: string }> }

export async function GET(_: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id

  try {
    const { saleId } = await params

    const contract = await prisma.contract.findFirst({
      where: {
        saleId,
        ...contractAccessWhere(currentUserId),
      },
      include: {
        sale: {
          include: {
            user: true,
            lot: {
              include: {
                block: true
              }
            }
          }
        }
      }
    })

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    return new NextResponse(contract.content, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('Erro ao buscar contrato:', error)
    return NextResponse.json(
      { error: 'Nao foi possivel carregar o contrato' },
      { status: 500 }
    )
  }
}
