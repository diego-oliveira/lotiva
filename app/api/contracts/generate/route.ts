import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { saleAccessWhere } from '@/lib/access-control'
import { NextResponse } from 'next/server'
import { generateContractNumber, generateContractHTML, getMissingBuyerFields, getMissingContractFields } from '@/lib/contractGenerator'

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id

  try {
    const { saleId, force, reason } = await req.json()

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
                  },
                },
              },
            },
          }
        },
        contract: true
      }
    })

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    const contractSettings = sale.lot.block.development?.contractSettings ?? null
    const missingFields = [
      ...getMissingBuyerFields(sale.user).map((field) => `Cliente: ${field}`),
      ...getMissingContractFields(contractSettings).map((field) => `Contrato: ${field}`),
    ]

    if (missingFields.length > 0) {
      return NextResponse.json({
        error: 'Dados obrigatorios pendentes para gerar contrato',
        missingFields,
      }, { status: 422 })
    }

    if (sale.contract && !force) {
      return NextResponse.json({
        message: 'Contract already exists',
        contract: sale.contract
      })
    }

    const contractNumber = sale.contract?.contractNumber ?? generateContractNumber()
    const contractData = {
      contractNumber,
      sale,
      generatedAt: new Date(),
      settings: contractSettings,
    }

    const contractHTML = generateContractHTML(contractData)

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
