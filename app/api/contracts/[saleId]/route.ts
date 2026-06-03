import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { contractAccessWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ saleId: string }> }

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id

  try {
    const { saleId } = await params
    const url = new URL(req.url)
    const wantsMeta = url.searchParams.get('meta') === '1'

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
                block: {
                  include: {
                    development: {
                      include: {
                        contractSettings: true,
                      },
                    },
                  },
                },
              }
            }
          }
        },
        events: {
          orderBy: { createdAt: 'desc' },
        },
      }
    })

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    if (wantsMeta) {
      const missingBuyerFields = [
        ['cpf', 'CPF'],
        ['rg', 'RG'],
        ['address', 'Endereco'],
        ['birthDate', 'Data de nascimento'],
        ['profession', 'Profissao'],
        ['birthplace', 'Naturalidade'],
        ['maritalStatus', 'Estado civil'],
      ].filter(([key]) => !String((contract.sale.user as any)[key] || '').trim()).map(([, label]) => label)

      const settings = contract.sale.lot.block.development?.contractSettings
      const missingSettings = [
        ['sellerName', 'Nome do vendedor'],
        ['sellerDocument', 'Documento do vendedor'],
        ['sellerAddress', 'Endereco do vendedor'],
        ['propertyDescription', 'Descricao do empreendimento'],
        ['paymentInstructions', 'Instrucoes de pagamento'],
        ['jurisdiction', 'Foro'],
      ].filter(([key]) => !String((settings as any)?.[key] || '').trim()).map(([, label]) => label)

      return NextResponse.json({
        id: contract.id,
        saleId: contract.saleId,
        contractNumber: contract.contractNumber,
        status: contract.status,
        version: contract.version,
        emailSent: contract.emailSent,
        emailSentAt: contract.emailSentAt,
        createdAt: contract.createdAt,
        updatedAt: contract.updatedAt,
        lastRegenerationReason: contract.lastRegenerationReason,
        missingFields: [
          ...missingBuyerFields.map((field) => `Cliente: ${field}`),
          ...missingSettings.map((field) => `Contrato: ${field}`),
        ],
        sale: {
          id: contract.sale.id,
          totalValue: contract.sale.totalValue,
          downPayment: contract.sale.downPayment,
          installmentCount: contract.sale.installmentCount,
          installmentValue: contract.sale.installmentValue,
          user: {
            id: contract.sale.user.id,
            name: contract.sale.user.name,
            email: contract.sale.user.email,
          },
          lot: {
            id: contract.sale.lot.id,
            identifier: contract.sale.lot.identifier,
            block: {
              identifier: contract.sale.lot.block.identifier,
              development: {
                name: contract.sale.lot.block.development?.name ?? 'Empreendimento',
              },
            },
          },
        },
        events: contract.events,
      })
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
