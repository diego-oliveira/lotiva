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
                        documentTemplate: {
                          include: {
                            versions: {
                              where: { status: 'published' },
                              orderBy: { version: 'desc' },
                              take: 1,
                            },
                          },
                        },
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
        documentTemplateVersion: {
          include: {
            template: { select: { id: true, name: true } },
          },
        },
      }
    })

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    if (wantsMeta) {
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
        currentDocumentTemplate: contract.sale.lot.block.development?.documentTemplate?.versions[0] ? {
          id: contract.sale.lot.block.development.documentTemplate.id,
          name: contract.sale.lot.block.development.documentTemplate.name,
          version: contract.sale.lot.block.development.documentTemplate.versions[0].version,
        } : null,
        documentTemplate: contract.documentTemplateVersion ? {
          id: contract.documentTemplateVersion.template.id,
          name: contract.documentTemplateVersion.template.name,
          version: contract.documentTemplateVersion.version,
          currentPublishedVersion: contract.sale.lot.block.development?.documentTemplate?.versions[0]?.version ?? null,
        } : null,
        missingFields: [],
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

    return NextResponse.redirect(new URL(`/api/contracts/${saleId}/pdf?inline=1`, req.url))

  } catch (error) {
    console.error('Erro ao buscar contrato:', error)
    return NextResponse.json(
      { error: 'Nao foi possivel carregar o contrato' },
      { status: 500 }
    )
  }
}
