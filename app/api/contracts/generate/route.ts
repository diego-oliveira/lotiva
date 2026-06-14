import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { saleAccessWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'
import { generateContractNumber, renderDocumentTemplate } from '@/lib/document-templates'

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id

  try {
    const { saleId, force, reason, useOriginalTemplate } = await req.json()

    if (!saleId) {
      return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 })
    }

    // Get the sale with all related data
    const sale = await prisma.sale.findFirst({
      where: {
        id: saleId,
        ...saleAccessWhere(currentUserId),
      },
      include: {
        user: true,
        lot: {
          include: {
            block: {
              include: {
                development: {
                  include: {
                    contractSettings: true,
                    company: {
                      include: { documentVariables: true },
                    },
                    documentValues: {
                      include: { variable: true },
                    },
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
        },
        proposal: true,
        contract: {
          include: {
            documentTemplateVersion: true,
          },
        },
      }
    })

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    if (sale.contract && !force) {
      return NextResponse.json({
        message: 'Contract already exists',
        contract: sale.contract
      })
    }

    const contractNumber = sale.contract?.contractNumber ?? generateContractNumber()
    const generatedAt = new Date()
    const selectedPublishedVersion = sale.lot.block.development?.documentTemplate?.versions[0] ?? null
    const templateVersion = useOriginalTemplate && sale.contract?.documentTemplateVersion
      ? sale.contract.documentTemplateVersion
      : selectedPublishedVersion

    if (!templateVersion) {
      return NextResponse.json(
        { error: 'O empreendimento nao possui um modelo de contrato publicado configurado.' },
        { status: 409 },
      )
    }

    const rendered = renderDocumentTemplate({
      content: templateVersion.content,
      sale,
      contractNumber,
      generatedAt,
    })
    const contractHTML = rendered.html
    const missingFields = rendered.missingVariables.map((variable) => `Variavel sem valor: {{${variable}}}`)

    if (missingFields.length > 0) {
      return NextResponse.json({
        error: 'Dados obrigatorios pendentes para gerar contrato',
        missingFields,
      }, { status: 422 })
    }

    const contract = await prisma.$transaction(async (tx) => {
      if (sale.contract) {
        const updated = await tx.contract.update({
          where: { id: sale.contract.id },
          data: {
            content: contractHTML,
            status: 'generated',
            version: { increment: 1 },
            lastRegenerationReason: reason || null,
            emailSent: false,
            emailSentAt: null,
            documentTemplateVersionId: templateVersion.id,
          },
        })

        await tx.contractEvent.create({
          data: {
            contractId: updated.id,
            userId: currentUserId,
            type: 'regenerated',
            title: 'Contrato regenerado',
            description: reason || 'Contrato regenerado a partir dos dados atuais da venda.',
          },
        })

        return updated
      }

      const created = await tx.contract.create({
        data: {
          saleId,
          contractNumber,
          content: contractHTML,
          status: 'generated',
          documentTemplateVersionId: templateVersion.id,
          events: {
            create: {
              userId: currentUserId,
              type: 'generated',
              title: 'Contrato gerado',
              description: 'Contrato gerado a partir dos dados da venda.',
            },
          },
        },
      })

      return created
    })

    return NextResponse.json({
      message: sale.contract ? 'Contract regenerated successfully' : 'Contract generated successfully',
      contract: {
        id: contract.id,
        contractNumber: contract.contractNumber,
        createdAt: contract.createdAt
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Error generating contract:', error)
    return NextResponse.json(
      { error: 'Failed to generate contract' },
      { status: 500 }
    )
  }
}
